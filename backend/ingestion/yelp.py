"""Yelp Fusion API ingester for restaurants/bars/food trucks/farmers markets.

Docs: https://docs.developer.yelp.com/docs/fusion-intro
Free tier: 5,000 calls/day. Get a key at https://www.yelp.com/developers (instant signup).
Set env var: YELP_API_KEY

`fetch_all()` returns FOUR lists keyed by destination collection:
  - restaurants     → /api/restaurants
  - food_trucks     → /api/foodtrucks (Yelp `foodtrucks` category alias)
  - market_events   → /api/events (with category='market'; Yelp `farmersmarket`
                      alias gets converted to a recurring weekly event)

Restaurant pull uses dual sort orders (rating + best_match) and dedupes
by Yelp business ID so we capture both top-rated locals and popular places.

Each restaurant carries an `is_chain` flag set by name-matching against a
hand-maintained list of major US chain brands. Frontend can use this to
toggle chains on/off in the listing.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

import httpx

from .utils import PILOT_LAT, PILOT_LON, PILOT_RADIUS_MILES, to_iso


# Hand-maintained list of common US chain brands. Yelp doesn't expose
# chain affiliation directly, so we name-match (case-insensitive substring).
# Ordered roughly by likelihood of appearing in a US metro.
CHAIN_NAMES = {
    # Burgers / fast food
    "mcdonald", "burger king", "wendy", "five guys", "shake shack", "smashburger",
    "checkers", "rally", "white castle", "in-n-out", "culver",
    # Chicken
    "chick-fil-a", "kfc", "popeyes", "bojangles", "zaxby", "raising cane",
    "wingstop", "buffalo wild wings", "chicken express", "church's chicken",
    "pdq",
    # Subs / sandwiches
    "subway", "jersey mike", "jimmy john", "firehouse subs", "potbelly",
    "quizno", "panera", "schlotzsky",
    # Mexican / Tex-Mex
    "taco bell", "chipotle", "qdoba", "moe's southwest", "del taco",
    "taco john", "el pollo loco",
    # Pizza
    "pizza hut", "domino", "papa john", "little caesars", "papa murphy",
    "marco's pizza", "round table",
    # Sit-down chains
    "olive garden", "outback", "longhorn", "texas roadhouse", "applebee",
    "ihop", "denny's", "dennys", "cracker barrel", "cheesecake factory",
    "tgi friday", "ruby tuesday", "chili's", "chilis", "red lobster",
    "red robin", "carraba", "bonefish grill", "logan's roadhouse",
    "lone star", "miller's ale house", "bj's restaurant", "carl's jr",
    "hardee", "perkins", "bob evans", "waffle house", "huddle house",
    "first watch", "another broken egg", "eggs up grill",
    # Asian chains
    "p.f. chang", "panda express", "pei wei", "benihana",
    # Coffee / breakfast
    "starbucks", "dunkin", "tim horton", "krispy kreme", "einstein bagel",
    "tropical smoothie", "smoothie king", "jamba",
    # Ice cream / dessert
    "baskin-robbins", "dairy queen", "cold stone", "ben & jerry",
    "menchie", "yogurtland", "kilwins",
    # Bars / sports
    "hooters", "world of beer", "miller's ale", "twin peak",
    "sonic drive", "sonic ", "arby", "long john silver",
    # Salad / health
    "salad and go", "saladworks", "sweetgreen", "cava", "freshii",
    # Steakhouses
    "ruth's chris", "morton's", "fleming's",
    # Italian
    "fazoli", "carrabba",
}


def _name_is_chain(name: str) -> bool:
    """Return True if the business name matches a known US chain brand."""
    n = (name or "").lower()
    return any(brand in n for brand in CHAIN_NAMES)


def _is_farmers_market(raw: Dict[str, Any]) -> bool:
    """Yelp's `farmersmarket` category alias indicates a farmers market.
    Also catches public markets / food halls flagged as such."""
    aliases = {(c.get("alias") or "").lower() for c in raw.get("categories", [])}
    return bool(aliases & {"farmersmarket", "farmers_market", "publicmarkets"})

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
    """Pull from Yelp once and split results across destination collections.

    Returns:
      - restaurants    → /api/restaurants
      - food_trucks    → /api/foodtrucks
      - market_events  → /api/events (category='market')
    """
    restaurants_raw = await _fetch_restaurants_raw()

    restaurants: List[Dict[str, Any]] = []
    food_trucks: List[Dict[str, Any]] = []
    market_events: List[Dict[str, Any]] = []

    for raw in restaurants_raw:
        if _is_farmers_market(raw):
            ev = _normalize_market_event(raw)
            if ev:
                market_events.append(ev)
        elif _is_food_truck(raw):
            ft = _normalize_food_truck(raw)
            if ft:
                food_trucks.append(ft)
        else:
            r = _normalize_restaurant(raw)
            if r:
                restaurants.append(r)

    log.info(
        f"Yelp split: {len(restaurants)} restaurants, "
        f"{len(food_trucks)} food trucks, {len(market_events)} farmer markets"
    )
    return {
        "restaurants": restaurants,
        "food_trucks": food_trucks,
        "market_events": market_events,
    }


def _next_saturday_morning() -> datetime:
    """Return next Saturday at 9:00 AM UTC.
    Used as a placeholder start time for ingested farmer markets — they
    typically run Saturday morning. Daily cron re-runs and refreshes the
    date forward each week."""
    now = datetime.now(timezone.utc)
    days_until_saturday = (5 - now.weekday()) % 7  # Mon=0..Sun=6, Sat=5
    if days_until_saturday == 0 and now.hour >= 12:
        days_until_saturday = 7
    target = now + timedelta(days=days_until_saturday)
    return target.replace(hour=9, minute=0, second=0, microsecond=0)


def _normalize_market_event(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convert a Yelp farmers-market business into a NearScene event.

    Yelp gives us location + rating but no schedule. We use 'next Saturday
    9 AM' as a placeholder start time so the market shows up on the markets
    tab. The description tells the user to verify the actual schedule.
    """
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

    start = _next_saturday_morning()
    description = (
        f"Local farmers market — fresh produce, baked goods, crafts, and more. "
        f"Schedule varies; please check the venue's official site for hours and dates."
    )

    return {
        "title": name,
        "description": description,
        "category": "market",
        "start_date": to_iso(start),
        "end_date": to_iso(start + timedelta(hours=4)),
        "location_name": name,
        "address": address,
        "city": location.get("city") or "",
        "state": location.get("state") or "",
        "zip_code": location.get("zip_code") or "",
        "latitude": lat,
        "longitude": lon,
        "image_url": raw.get("image_url"),
        "is_paid": False,
        "ticket_price": None,
        "discount_percentage": None,
        "total_tickets": None,
        "is_promoted": False,
        "tags": ["farmers_market", "local"],
        "mood_tags": ["family_friendly", "outdoor", "dog_friendly"],
        "external_url": raw.get("url"),
        "_source": "yelp_market",
        "_source_id": raw.get("id"),
        "_source_url": raw.get("url"),
    }


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
        "is_chain": _name_is_chain(name),
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
        "is_chain": _name_is_chain(name),
        "_source": "yelp",
        "_source_id": raw.get("id"),
        "_source_url": raw.get("url"),
    }
