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
import asyncio
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


def _normalize_name(s: Optional[str]) -> str:
    """Normalize a business name for fuzzy matching: lowercase, strip
    everything except letters/digits/spaces, collapse whitespace.
    'Chick-fil-A' → 'chickfila', 'McDonald's' → 'mcdonalds'."""
    if not s:
        return ""
    cleaned = "".join(c.lower() for c in s if c.isalnum() or c.isspace())
    return " ".join(cleaned.split())


def _name_is_chain(name: str) -> bool:
    """Return True if the business name matches a known US chain brand.
    Uses normalized substring matching so punctuation/casing differences
    don't trip us up."""
    norm = _normalize_name(name)
    return any(_normalize_name(brand) in norm for brand in CHAIN_NAMES)


def _name_matches_search_term(business_name: str, search_term: str) -> bool:
    """Whether a Yelp search result actually matches the chain we searched for.

    We need this because Yelp's term=Buffalo+Wild+Wings can return tangential
    results (e.g. 'Wild Buffalo Bar'). Use a token-set match: every token of
    the search term must appear in the business name (after normalization).
    """
    name_norm = _normalize_name(business_name)
    term_tokens = _normalize_name(search_term).split()
    if not term_tokens:
        return False
    return all(tok in name_norm for tok in term_tokens)


# Curated list of popular US chains to search for explicitly. Yelp's best_match
# sort biases toward local independents — chains like BWW, Olive Garden, etc.
# usually don't crack the top 200 even though they exist within radius.
# A targeted search by name reliably surfaces them.
#
# Keep this list focused (~25 entries) — each entry is one extra Yelp API call.
# We're at ~10 calls/run today; adding 25 puts us at 35/day vs. 5000 budget.
CHAIN_SEARCH_TERMS = [
    "Buffalo Wild Wings",
    "Olive Garden",
    "Outback Steakhouse",
    "Texas Roadhouse",
    "Applebee's",
    "Chili's",
    "Cracker Barrel",
    "IHOP",
    "Denny's",
    "Cheesecake Factory",
    "Red Lobster",
    "Longhorn Steakhouse",
    "P.F. Chang's",
    "Panda Express",
    "Chipotle",
    "Taco Bell",
    "Chick-fil-A",
    "Popeyes",
    "Bojangles",
    "Zaxby's",
    "Raising Cane's",
    "McDonald's",
    "Wendy's",
    "Burger King",
    "Five Guys",
    "Panera Bread",
    "First Watch",
    "Cracker Barrel",
    "Hooters",
    "Waffle House",
]


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


async def debug_chain_searches() -> Dict[str, Any]:
    """Run only the explicit chain searches and return per-term diagnostics.
    Used by /api/admin/test-yelp-chains to debug why chains aren't being detected.
    Does not write to the database."""
    api_key = os.environ.get("YELP_API_KEY")
    if not api_key:
        return {"error": "YELP_API_KEY not set"}

    radius_m = min(int(PILOT_RADIUS_MILES * MILES_TO_METERS), 40000)
    headers = {"Authorization": f"Bearer {api_key}"}

    per_term: List[Dict[str, Any]] = []
    total_matches = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        for term in CHAIN_SEARCH_TERMS:
            entry: Dict[str, Any] = {"term": term}
            try:
                resp = await client.get(
                    API_BASE,
                    params={
                        "term": term,
                        "latitude": PILOT_LAT,
                        "longitude": PILOT_LON,
                        "radius": radius_m,
                        "limit": 5,
                    },
                    headers=headers,
                )
            except Exception as e:
                entry["error"] = str(e)
                per_term.append(entry)
                continue

            entry["status"] = resp.status_code
            if resp.status_code != 200:
                entry["body_preview"] = resp.text[:200]
                per_term.append(entry)
                continue

            data = resp.json()
            businesses = data.get("businesses", [])
            entry["raw_count"] = len(businesses)
            entry["raw_names"] = [b.get("name") for b in businesses]

            matches = [b for b in businesses
                       if _name_matches_search_term(b.get("name"), term)]
            entry["matched_count"] = len(matches)
            entry["matched_names"] = [b.get("name") for b in matches]
            total_matches += len(matches)
            per_term.append(entry)

    return {
        "total_chain_matches": total_matches,
        "terms_with_matches": sum(1 for e in per_term if e.get("matched_count")),
        "terms_with_zero_matches": sum(1 for e in per_term if e.get("matched_count") == 0),
        "per_term": per_term,
    }


async def debug_full_fetch() -> Dict[str, Any]:
    """Run the full _fetch_restaurants_raw and report counts at every pass.
    Tells us whether chain searches are reaching the unified candidate list."""
    api_key = os.environ.get("YELP_API_KEY")
    if not api_key:
        return {"error": "YELP_API_KEY not set"}

    radius_m = min(int(PILOT_RADIUS_MILES * MILES_TO_METERS), 40000)
    headers = {"Authorization": f"Bearer {api_key}"}

    pass1_count = 0   # rating sort
    pass2_count = 0   # best_match sort
    pass3_count = 0   # chain searches
    all_businesses: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for sort_order in ("rating", "best_match"):
            for page in range(PAGES_TO_FETCH):
                params = {
                    "latitude": PILOT_LAT, "longitude": PILOT_LON, "radius": radius_m,
                    "categories": "restaurants,bars,food,foodtrucks",
                    "limit": PER_PAGE, "offset": page * PER_PAGE, "sort_by": sort_order,
                }
                resp = await client.get(API_BASE, params=params, headers=headers)
                if resp.status_code != 200:
                    break
                businesses = resp.json().get("businesses", [])
                if sort_order == "rating":
                    pass1_count += len(businesses)
                else:
                    pass2_count += len(businesses)
                all_businesses.extend(businesses)
                if len(businesses) < PER_PAGE:
                    break

        # Sequential to match production code path (parallel hits rate limit)
        for term in CHAIN_SEARCH_TERMS:
            try:
                resp = await client.get(API_BASE, params={
                    "term": term, "latitude": PILOT_LAT, "longitude": PILOT_LON,
                    "radius": radius_m, "limit": 5,
                }, headers=headers)
            except httpx.HTTPError:
                continue
            if resp.status_code != 200:
                continue
            businesses = resp.json().get("businesses", [])
            matches = [b for b in businesses
                       if _name_matches_search_term(b.get("name"), term)]
            pass3_count += len(matches)
            all_businesses.extend(matches)

    by_id: Dict[str, Dict[str, Any]] = {}
    for raw in all_businesses:
        bid = raw.get("id")
        if bid and bid not in by_id:
            by_id[bid] = raw

    # Now classify the deduped list the same way fetch_all does
    all_unique = list(by_id.values())
    chain_in_unique = sum(1 for b in all_unique if _name_is_chain(b.get("name", "")))
    fm_count = sum(1 for b in all_unique if _is_farmers_market(b))
    ft_count = sum(1 for b in all_unique if _is_food_truck(b))

    return {
        "pass1_rating_count": pass1_count,
        "pass2_best_match_count": pass2_count,
        "pass3_chain_count": pass3_count,
        "all_businesses_count": len(all_businesses),
        "unique_after_dedup_by_id": len(all_unique),
        "chain_tagged_in_unique": chain_in_unique,
        "farmer_markets_in_unique": fm_count,
        "food_trucks_in_unique": ft_count,
        "would_go_to_restaurants": len(all_unique) - fm_count - ft_count,
        "chain_names_in_unique": [
            b["name"] for b in all_unique if _name_is_chain(b.get("name", ""))
        ][:50],
    }


async def _fetch_restaurants_raw() -> List[Dict[str, Any]]:
    """Inner helper: returns raw deduped Yelp business dicts before normalization.

    Three query passes, all merged + deduped by Yelp business ID:
      1. sort_by=rating       → high-quality independents
      2. sort_by=best_match   → Yelp's relevance ranking
      3. term=<chain name>    → one query per known US chain brand to make
                                 sure popular chains aren't dropped by 1+2's
                                 ranking algorithms
    """
    api_key = os.environ.get("YELP_API_KEY")
    if not api_key:
        log.warning("YELP_API_KEY not set; skipping Yelp ingestion")
        return []

    radius_m = min(int(PILOT_RADIUS_MILES * MILES_TO_METERS), 40000)
    headers = {"Authorization": f"Bearer {api_key}"}
    all_businesses: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Pass 1+2: rating + best_match sorts (4 pages each)
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
                        break

            # Pass 3: explicit chain searches — one query per known chain name.
            # Run SEQUENTIALLY (not asyncio.gather) because Yelp rate-limits
            # parallel bursts: testing showed 30 parallel calls returned 7
            # results vs. 70 when sequential. ~30 calls × 300ms = ~9s overhead,
            # well within the request timeout.
            chain_count = 0
            for term in CHAIN_SEARCH_TERMS:
                try:
                    resp = await client.get(
                        API_BASE,
                        params={
                            "term": term,
                            "latitude": PILOT_LAT,
                            "longitude": PILOT_LON,
                            "radius": radius_m,
                            "limit": 5,
                        },
                        headers=headers,
                    )
                except httpx.HTTPError as e:
                    log.warning(f"Chain search '{term}' failed: {e}")
                    continue
                if resp.status_code != 200:
                    log.warning(f"Chain search '{term}' status {resp.status_code}")
                    continue
                businesses = resp.json().get("businesses", [])
                matches = [b for b in businesses
                           if _name_matches_search_term(b.get("name"), term)]
                all_businesses.extend(matches)
                chain_count += len(matches)
            log.info(f"Yelp explicit chain search added {chain_count} chain businesses")

    except httpx.HTTPError as e:
        log.error(f"Yelp API error: {e}")
        return []

    # Dedupe by Yelp ID — businesses can appear in multiple passes.
    by_id: Dict[str, Dict[str, Any]] = {}
    for raw in all_businesses:
        bid = raw.get("id")
        if bid and bid not in by_id:
            by_id[bid] = raw
    log.info(f"Yelp total {len(all_businesses)} raw rows, {len(by_id)} unique businesses")
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
