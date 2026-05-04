"""Shared helpers for the ingestion pipeline.

The pilot region is Wilmington, NC. Override via env vars in production.
"""
import hashlib
import os
import re
from datetime import datetime, timezone
from typing import Optional


# === Pilot region: Wilmington, NC ===
# Lat/Lon center plus a 30-mile radius covers Wilmington, Wrightsville Beach,
# Carolina Beach, Kure Beach, Leland, and Hampstead.
PILOT_LAT = float(os.environ.get("PILOT_LAT", "34.2257"))
PILOT_LON = float(os.environ.get("PILOT_LON", "-77.9447"))
PILOT_RADIUS_MILES = float(os.environ.get("PILOT_RADIUS_MILES", "30"))
PILOT_CITY = os.environ.get("PILOT_CITY", "Wilmington")
PILOT_STATE = os.environ.get("PILOT_STATE", "NC")


def event_dedup_key(title: str, start_date: str, location_name: str) -> str:
    """Stable hash for cross-source event dedup based on TITLE + hour.

    Catches concerts where the title differs slightly across sources:
      'Waylon Wyatt - Everywhere Under The Sun' (Ticketmaster)
      'Waylon Wyatt' (SeatGeek)
    Both reduce to 'waylon wyatt' (first 2 normalized tokens).

    But it MISSES sports events because home/away framing flips the title:
      'UNC Wilmington Seahawks vs High Point Panthers'  (TM)
      'High Point Panthers at UNC Wilmington Seahawks'  (SG)
    For those we use `event_location_dedup_key` below as a second pass.
    """
    title_tokens = _normalize(title).split()[:2]
    title_part = " ".join(title_tokens)
    date_part = (start_date or "")[:13]   # YYYY-MM-DDTHH (hour precision)
    normalized = f"{title_part}|{date_part}"
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def event_location_dedup_key(latitude: float, longitude: float, start_date: str) -> str:
    """Secondary dedup key based on geographic coordinates + start hour.

    Same venue at the same hour is overwhelmingly the same event regardless
    of how the title is worded. Catches sports games whose titles are flipped
    home/away across sources.

    Lat/lon rounded to 3 decimals (~110m precision) so tiny coordinate
    differences from the two source databases don't cause false misses.

    Trade-off: a rare double-booking (e.g. concert + comedy show at the
    same arena in the same hour) would falsely dedupe. We accept that.
    """
    if latitude is None or longitude is None:
        return ""  # Can't dedupe by location if we don't have coords
    lat_part = f"{round(float(latitude), 3)}"
    lon_part = f"{round(float(longitude), 3)}"
    date_part = (start_date or "")[:13]
    normalized = f"{lat_part}|{lon_part}|{date_part}"
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def business_dedup_key(name: str, address: str) -> str:
    """Stable hash for restaurant/business dedup."""
    normalized = f"{_normalize(name)}|{_normalize(address)}"
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def _normalize(text: Optional[str]) -> str:
    if not text:
        return ""
    # Lowercase, strip punctuation/extra whitespace, collapse spaces
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9 ]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def to_iso(dt: datetime) -> str:
    """Mongo-friendly ISO string in UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def parse_iso_safe(s: Optional[str]) -> Optional[datetime]:
    """Parse a variety of ISO datetime strings; return None on failure."""
    if not s:
        return None
    try:
        # Handle trailing Z (Zulu / UTC)
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def map_category_from_text(text: str) -> str:
    """Best-effort mapping from external category strings to NearScene categories."""
    if not text:
        return "other"
    t = text.lower()
    if any(k in t for k in ["concert", "music", "band", "dj", "festival"]):
        if "food" in t:
            return "food_festival"
        return "concert"
    if any(k in t for k in ["sport", "football", "basketball", "baseball", "hockey", "soccer",
                              "race", "nba", "nfl", "mlb", "nhl", "wrestling", "boxing", "ufc",
                              "tennis", "golf", "lacrosse", "volleyball", "rugby", "cycling"]):
        if "marathon" in t or "run" in t:
            return "marathon"
        return "sports"
    if "parade" in t:
        return "parade"
    if "marathon" in t or "5k" in t or "10k" in t:
        return "marathon"
    if "market" in t or "fair" in t or "bazaar" in t:
        return "market"
    if "happy hour" in t:
        return "happy_hour"
    if "garage" in t or "yard sale" in t:
        return "garage_sale"
    if "food" in t or "wine" in t or "beer" in t or "tasting" in t:
        return "food_festival"
    if any(k in t for k in ["theater", "theatre", "comedy", "show", "performance"]):
        return "concert"
    return "other"
