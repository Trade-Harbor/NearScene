"""Local news ingester via Google News RSS.

Why Google News RSS:
- Truly free, no API key, no signup, no rate limit on the public RSS feed
- Aggregates from all major Wilmington-area outlets:
    StarNews Online, WECT, WHQR, Port City Daily, WWAY, Greater Wilmington
    Business Journal, Carolina Coast, etc.
- One query: ?q=Wilmington+NC returns the freshest hits

Strategy: pull the RSS once per day in the cron, parse, dedupe by source URL,
store with timestamp. Frontend reads via /api/news.

We use stdlib `xml.etree.ElementTree` for parsing — no extra dependencies.
"""
import logging
import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Dict, Any, Optional
from urllib.parse import quote_plus
from xml.etree import ElementTree as ET

import httpx

from .utils import PILOT_CITY, PILOT_STATE

log = logging.getLogger(__name__)

# Google News RSS endpoint. The query string supports site/source operators.
# Example: q=Wilmington+NC returns articles mentioning Wilmington, NC.
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"


def _build_query() -> str:
    """Construct the search query for the pilot region."""
    return f"{PILOT_CITY} {PILOT_STATE}"


async def fetch_news() -> List[Dict[str, Any]]:
    """Fetch local news items for the pilot region. Returns NearScene-shape news docs."""
    query = _build_query()
    params = {"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(GOOGLE_NEWS_RSS, params=params)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        log.error(f"Google News RSS error: {e}")
        return []

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as e:
        log.error(f"Google News RSS parse error: {e}")
        return []

    items: List[Dict[str, Any]] = []
    for item in root.iter("item"):
        norm = _normalize_item(item)
        if norm:
            items.append(norm)

    log.info(f"Google News returned {len(items)} articles for '{query}'")
    return items


def _normalize_item(item: ET.Element) -> Optional[Dict[str, Any]]:
    """Convert an RSS <item> to NearScene's news doc shape."""
    title = _text(item, "title")
    link = _text(item, "link")
    if not title or not link:
        return None

    # Google News titles are formatted like "Article Title - Source Name".
    # Split off the source for cleaner display.
    source_name = ""
    clean_title = title
    if " - " in title:
        # Take everything after the last " - " as the source name
        parts = title.rsplit(" - ", 1)
        if len(parts) == 2:
            clean_title = parts[0]
            source_name = parts[1]

    # Source can also be in <source> element if Google decided to put it there
    if not source_name:
        source_el = item.find("source")
        if source_el is not None and source_el.text:
            source_name = source_el.text

    # pubDate is RFC 2822 format: "Mon, 04 May 2026 13:45:00 GMT"
    pub_date_str = _text(item, "pubDate")
    pub_date_iso = ""
    if pub_date_str:
        try:
            dt = parsedate_to_datetime(pub_date_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            pub_date_iso = dt.isoformat()
        except (ValueError, TypeError):
            pub_date_iso = ""

    description_raw = _text(item, "description") or ""
    # Description is HTML — strip tags for clean preview
    description = _strip_html(description_raw)[:300]

    return {
        "title": clean_title,
        "link": link,
        "source": source_name or "Google News",
        "published_at": pub_date_iso,
        "summary": description,
        "_source": "google_news",
        "_source_id": link,  # link is unique per article
    }


def _text(el: ET.Element, tag: str) -> str:
    child = el.find(tag)
    if child is None or child.text is None:
        return ""
    return child.text.strip()


def _strip_html(html: str) -> str:
    """Naive HTML tag stripping. Good enough for news previews — Google's
    descriptions are simple <a><font>... markup."""
    out: List[str] = []
    in_tag = False
    for ch in html:
        if ch == "<":
            in_tag = True
            continue
        if ch == ">":
            in_tag = False
            continue
        if not in_tag:
            out.append(ch)
    text = "".join(out)
    # Decode common HTML entities
    return (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .strip()
    )
