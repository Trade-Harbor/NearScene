"""Yelp Fusion API ingester for restaurants/bars/businesses.

Docs: https://docs.developer.yelp.com/docs/fusion-intro
Free tier: 5,000 calls/day. Get a key at https://www.yelp.com/developers (instant signup).
Set env var: YELP_API_KEY

Yelp returns up to 50 results per call; we paginate up to ~200 results
to stay polite on the free tier.
"""
import logging
import os
from typing import List, Dict, Any, Optional

import httpx

from .utils import PILOT_LAT, PILOT_LON, PILOT_RADIUS_MILES

log = logging.getLogger(__name__)

API_BASE = "https://api.yelp.com/v3/businesses/search"
# Yelp radius is in meters; max is 40000 (≈25 miles). Cap for safety.
MILES_TO_METERS = 1609.34
PAGES_TO_FETCH = 4  # 4 × 50 = 200 results max
PER_PAGE = 50


async def fetch_restaurants() -> List[Dict[str, Any]]:
    """Fetch nearby restaurants/bars and normalize to NearScene's restaurant shape."""
    api_key = os.environ.get("YELP_API_KEY")
    if not api_key:
        log.warning("YELP_API_KEY not set; skipping Yelp ingestion")
        return []

    radius_m = min(int(PILOT_RADIUS_MILES * MILES_TO_METERS), 40000)

    headers = {"Authorization": f"Bearer {api_key}"}
    all_businesses: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for page in range(PAGES_TO_FETCH):
                params = {
                    "latitude": PILOT_LAT,
                    "longitude": PILOT_LON,
                    "radius": radius_m,
                    "categories": "restaurants,bars,food",
                    "limit": PER_PAGE,
                    "offset": page * PER_PAGE,
                    "sort_by": "rating",
                }
                resp = await client.get(API_BASE, params=params, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                businesses = data.get("businesses", [])
                all_businesses.extend(businesses)
                if len(businesses) < PER_PAGE:
                    break  # No more pages
    except httpx.HTTPError as e:
        log.error(f"Yelp API error: {e}")
        return []

    log.info(f"Yelp returned {len(all_businesses)} raw businesses")

    normalized: List[Dict[str, Any]] = []
    for raw in all_businesses:
        r = _normalize_restaurant(raw)
        if r:
            normalized.append(r)

    log.info(f"Yelp normalized {len(normalized)} restaurants")
    return normalized


def _normalize_restaurant(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    name = raw.get("name")
    if not name:
        return None

    coords = raw.get("coordinates") or {}
    try:
        lat = float(coords.get("latitude")) if coords.get("latitude") is not None else None
        lon = float(coords.get("longitude")) if coords.get("longitude") is not None else None
    except (TypeError, ValueError):
        lat, lon = None, None
    if lat is None or lon is None:
        return None

    location = raw.get("location") or {}
    address_lines = location.get("display_address") or []
    address = ", ".join(address_lines) if address_lines else (location.get("address1") or "")

    categories = raw.get("categories") or []
    cuisine = categories[0]["title"] if categories else "Restaurant"
    category_tags = [c.get("alias") for c in categories if c.get("alias")]

    return {
        "name": name,
        "description": f"{cuisine} in {location.get('city', '')}",
        "cuisine_type": cuisine,
        "address": address,
        "city": location.get("city") or "",
        "state": location.get("state") or "",
        "zip_code": location.get("zip_code") or "",
        "latitude": lat,
        "longitude": lon,
        "image_url": raw.get("image_url"),
        "phone": raw.get("display_phone") or raw.get("phone") or "",
        "website": raw.get("url"),  # Yelp page URL
        "rating": float(raw.get("rating") or 0),
        "review_count": int(raw.get("review_count") or 0),
        "price_level": raw.get("price") or "",  # "$", "$$", "$$$", "$$$$"
        "tags": category_tags,
        "_source": "yelp",
        "_source_id": raw.get("id"),
        "_source_url": raw.get("url"),
    }
