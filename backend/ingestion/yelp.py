"""Yelp Fusion API ingester for restaurants/bars/food trucks.

Docs: https://docs.developer.yelp.com/docs/fusion-intro
Free tier: 5,000 calls/day. Get a key at https://www.yelp.com/developers (instant signup).
Set env var: YELP_API_KEY

Returns TWO lists from `fetch_all()`: (restaurants, food_trucks). Yelp tags
real food trucks with the category alias `foodtrucks`; we route those into
the food_trucks collection rather than restaurants so the user-facing
"Food Trucks" page matches what people expect.

Restaurants pull uses dual sort orders (rating + best_match) and dedupes
by Yelp business ID so we capture both top-rated locals and popular places.
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


def _is_food_truck(raw: Dict[str, Any]) -> bool:
    """A Yelp business is a food truck if it carries the `foodtrucks` alias
    (or a tight set of related aliases) in its categories."""
    aliases = {(c.get("alias") or "").lower() for c in raw.get("categories", [])}
    return bool(aliases & {"foodtrucks", "streetvendors", "food_trucks"})


async def fetch_all() -> Dict[str, List[Dict[str, Any]]]:
    """Pull from Yelp once and split results into restaurants + food trucks.

    Returns: {"restaurants": [...], "food_trucks": [...]}
    """
    restaurants_raw = await _fetch_restaurants_raw()

    restaurants: List[Dict[str, Any]] = []
    food_trucks: List[Dict[str, Any]] = []
    for raw in restaurants_raw:
        if _is_food_truck(raw):
            ft = _normalize_food_truck(raw)
            if ft:
                food_trucks.append(ft)
        else:
            r = _normalize_restaurant(raw)
            if r:
                restaurants.append(r)

    log.info(f"Yelp split: {len(restaurants)} restaurants, {len(food_trucks)} food trucks")
    return {"restaurants": restaurants, "food_trucks": food_trucks}


async def _fetch_restaurants_raw() -> List[Dict[str, Any]]:
    """Inner helper: returns raw deduped Yelp business dicts before normalization."""
    api_key = os.environ.get("YELP_API_KEY")
    if not api_key:
        log.warning("YELP_API_KEY not set; skipping Yelp ingestion")
        return []

    radius_m = min(int(PILOT_RADIUS_MILES * MILES_TO_METERS), 40000)
    headers = {"Authorization": f"Bearer {api_key}"}
    all_businesses: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Two sort orders: rating (top locals) + best_match (popularity, surfaces chains)
            for sort_order in ("rating", "best_match"):
                for page in range(PAGES_TO_FETCH):
                    params = {
                        "latitude": PILOT_LAT,
                        "longitude": PILOT_LON,
                        "radius": radius_m,
                        "categories": "restaurants,bars,food,foodtrucks",
                        "limit": PER_PAGE,
                        "offset": page * PER_PAGE,
                        "sort_by": sort_order,
                    }
                    resp = await client.get(API_BASE, params=params, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    businesses = data.get("businesses", [])
                    all_businesses.extend(businesses)
                    if len(businesses) < PER_PAGE:
                        break  # No more results in this sort order
    except httpx.HTTPError as e:
        log.error(f"Yelp API error: {e}")
        return []

    # Dedupe by Yelp ID so businesses appearing in both sort orders count once.
    by_id: Dict[str, Dict[str, Any]] = {}
    for raw in all_businesses:
        bid = raw.get("id")
        if bid and bid not in by_id:
            by_id[bid] = raw
    log.info(f"Yelp returned {len(all_businesses)} raw rows, {len(by_id)} unique businesses")
    return list(by_id.values())


def _normalize_food_truck(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map a Yelp food-truck business to NearScene's FoodTruck doc shape."""
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
    cuisine = next(
        (c["title"] for c in categories if (c.get("alias") or "").lower() not in
         {"foodtrucks", "streetvendors", "food_trucks"}),
        "Food Truck",
    )

    return {
        "name": name,
        "description": f"{cuisine} food truck in {location.get('city', '')}",
        "cuisine_type": cuisine,
        "address": address,
        "city": location.get("city") or "",
        "state": location.get("state") or "",
        "zip_code": location.get("zip_code") or "",
        "latitude": lat,
        "longitude": lon,
        "image_url": raw.get("image_url"),
        "operating_hours": "Hours vary — check Yelp for current location",
        "menu_highlights": [],
        "rating": float(raw.get("rating") or 0),
        "review_count": int(raw.get("review_count") or 0),
        "_source": "yelp",
        "_source_id": raw.get("id"),
        "_source_url": raw.get("url"),
    }


async def fetch_restaurants() -> List[Dict[str, Any]]:
    """Back-compat thin wrapper — restaurants only (no food trucks).

    New code should call fetch_all() directly to get both lists.
    """
    split = await fetch_all()
    return split["restaurants"]


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

    # Yelp returns price as "$", "$$", "$$$", "$$$$" — map to NearScene's int 1-4.
    # Restaurants without price info default to 2 ($$, mid-range).
    price_str = raw.get("price") or ""
    price_level = len(price_str) if price_str else 2

    # Yelp's free tier doesn't return hours via search — leave empty dict.
    # NearScene's `is_open_now` will then default to False (acceptable for now).
    hours: dict = {}

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
        "price_level": price_level,
        "hours": hours,
        "features": [],
        "mood_tags": [],
        "tags": category_tags,
        "_source": "yelp",
        "_source_id": raw.get("id"),
        "_source_url": raw.get("url"),
    }
