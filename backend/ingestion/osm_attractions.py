"""OpenStreetMap Overpass API ingester for attractions, parks, beaches, museums.

Why OSM instead of Google Places:
- Truly free, no signup, no credit card, no rate-limit risk
- Overpass API is a public read-only endpoint backed by community-maintained data
- Wilmington has solid OSM coverage for parks, beaches, trails, museums, landmarks

Trade-offs vs. Google Places:
- No photos (we use a placeholder)
- Less complete metadata (hours, phone, website are sometimes missing)
- Quality depends on local OSM contributors

For Wilmington, NC the available data covers:
- Greenfield Lake Park, Hugh MacRae Park, Halyburton Park, etc.
- Wrightsville Beach, Carolina Beach, Kure Beach access points
- Cameron Art Museum, Battleship North Carolina, Cape Fear Museum
- Riverwalk, Airlie Gardens
- Hiking trails in Brunswick / Pender counties
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlencode

import httpx

from .utils import PILOT_LAT, PILOT_LON, PILOT_RADIUS_MILES

log = logging.getLogger(__name__)

# Public Overpass mirrors. We try them in order — main first, then community
# fallbacks. Free Overpass instances rate-limit aggressively so multi-mirror
# is essential for reliable daily ingestion.
OVERPASS_URLS = [
    "https://lz4.overpass-api.de/api/interpreter",   # Cloudflare-fronted, fastest from US
    "https://overpass-api.de/api/interpreter",        # Main
    "https://overpass.kumi.systems/api/interpreter",  # Community mirror (Germany)
    "https://overpass.private.coffee/api/interpreter",
]

# Per-mirror HTTP timeout. Bumped to 60s after expanding the query to cover
# fitness courts, recreation venues, etc. The query is now ~80 clauses so
# Overpass needs more time, especially during peak hours. With 4 mirrors
# we could in theory wait 240s, but in practice the first mirror succeeds
# the vast majority of the time, so 60s is fine within Render's ~100s
# request limit.
PER_MIRROR_TIMEOUT = 60.0

MILES_TO_METERS = 1609.34

# Per-attraction-type stock images. Used when OSM doesn't give us a real photo
# (which is most of the time — OSM doesn't host images). Curated free-to-use
# Unsplash photos that match the kind of place. Picked one per type so the
# Explore page doesn't show 300 copies of the same forest.
TYPE_STOCK_IMAGES = {
    "park":           "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
    "beach":          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    "museum":         "https://images.unsplash.com/photo-1565060169187-eef72ce29e0d?w=800",
    "landmark":       "https://images.unsplash.com/photo-1549893072-4bc678117f45?w=800",
    "hiking_trail":   "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800",
    "attraction":     "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800",
    "garden":         "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800",
    "playground":     "https://images.unsplash.com/photo-1551966775-a4ddc8df052b?w=800",
    # Recreation / things-to-do
    "golf_course":    "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",  # green fairway
    "mini_golf":      "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800",  # also fairway-like
    "bowling":        "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800",  # bowling pins
    "go_karts":       "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800",  # racing
    "arcade":         "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800",  # arcade
    "sports_centre":  "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800",  # gym/sports
    "ice_rink":       "https://images.unsplash.com/photo-1551541090-9cf52ed5da89?w=800",     # ice skating
    "skate_park":     "https://images.unsplash.com/photo-1565992441121-4367c2967103?w=800",  # skate
    "swimming_pool":  "https://images.unsplash.com/photo-1560090995-01632a28895b?w=800",     # pool
    "fitness":        "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800",  # gym
    "amusement":      "https://images.unsplash.com/photo-1568287859870-7a39b0b16c2c?w=800",  # amusement
    "water_park":     "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800",     # water park
    # Sports courts/fields (leisure=pitch + sport=*)
    "tennis_court":      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",   # tennis court
    "basketball_court":  "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",   # basketball court
    "pickleball_court":  "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",   # courts
    "soccer_field":      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800",# soccer pitch
    "volleyball_court":  "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800",# beach volleyball
}
DEFAULT_STOCK_IMAGE = TYPE_STOCK_IMAGES["attraction"]

# Map OSM tags to LocalDrift attraction_type. Order matters — first match wins.
OSM_TYPE_MAP = [
    # (key, value, attraction_type, default_amenities, mood_tags, default_image)
    ("leisure", "park", "park", ["walking_trails"], ["family_friendly", "outdoor", "dog_friendly"], None),
    ("natural", "beach", "beach", ["parking"], ["family_friendly", "outdoor"], None),
    ("tourism", "museum", "museum", [], ["indoor"], None),
    ("tourism", "gallery", "museum", [], ["indoor"], None),
    ("tourism", "attraction", "landmark", [], ["outdoor"], None),
    ("tourism", "viewpoint", "landmark", [], ["outdoor", "scenic"], None),
    ("tourism", "zoo", "attraction", ["parking"], ["family_friendly"], None),
    ("tourism", "aquarium", "attraction", ["parking"], ["family_friendly", "indoor"], None),
    ("historic", "monument", "landmark", [], ["outdoor"], None),
    ("historic", "memorial", "landmark", [], ["outdoor"], None),
    ("historic", "ruins", "landmark", [], ["outdoor"], None),
    ("historic", "castle", "landmark", [], ["outdoor"], None),
    ("leisure", "garden", "park", [], ["outdoor", "family_friendly"], None),
    ("leisure", "nature_reserve", "park", ["walking_trails"], ["outdoor"], None),
    ("highway", "trailhead", "hiking_trail", [], ["outdoor", "fitness"], None),
    ("route", "hiking", "hiking_trail", [], ["outdoor", "fitness"], None),
    # Recreation / things-to-do — extended for the new Explore filter
    ("leisure", "golf_course",      "golf_course",   ["parking"], ["outdoor", "fitness"], None),
    ("leisure", "miniature_golf",   "mini_golf",     ["parking"], ["family_friendly", "outdoor"], None),
    ("leisure", "bowling_alley",    "bowling",       ["parking"], ["family_friendly", "indoor"], None),
    ("leisure", "adult_gaming_centre","arcade",      [],          ["indoor"], None),
    ("leisure", "amusement_arcade", "arcade",        [],          ["family_friendly", "indoor"], None),
    ("leisure", "sports_centre",    "sports_centre", ["parking"], ["fitness", "indoor"], None),
    ("leisure", "fitness_centre",   "fitness",       ["parking"], ["fitness", "indoor"], None),
    ("leisure", "fitness_station",  "fitness",       [],          ["fitness", "outdoor"], None),
    ("leisure", "ice_rink",         "ice_rink",      ["parking"], ["family_friendly", "indoor"], None),
    ("leisure", "skate_park",       "skate_park",    [],          ["fitness", "outdoor"], None),
    ("leisure", "swimming_pool",    "swimming_pool", [],          ["family_friendly"], None),
    ("leisure", "water_park",       "water_park",    ["parking"], ["family_friendly", "outdoor"], None),
    ("tourism", "theme_park",       "amusement",     ["parking"], ["family_friendly", "outdoor"], None),
    ("tourism", "amusement_park",   "amusement",     ["parking"], ["family_friendly", "outdoor"], None),
    # Sport-specific tracks (go-karts etc.)
    ("sport",   "karting",          "go_karts",      ["parking"], ["family_friendly"], None),
    ("sport",   "motor",            "go_karts",      ["parking"], ["outdoor"], None),
]


def _build_query(lat: float, lon: float, radius_m: int) -> str:
    """Build an Overpass QL query that pulls attraction-type nodes/ways/relations
    within the radius. Uses simple equality matchers (more reliable than regex
    in Overpass QL) and `out center;` which includes tags + center coords for
    ways/relations."""
    # Leisure features that are commonly tagged as multi-polygon relations
    # (large geographic areas). Worth the extra `relation()` clause cost.
    leisure_area_values = ["park", "garden", "nature_reserve"]
    # Leisure features that are virtually always nodes or ways (a building
    # footprint or a single point). Skipping `relation()` here avoids ~40%
    # of the Overpass query work.
    leisure_point_values = [
        "playground",
        # Recreation / things-to-do
        "golf_course", "miniature_golf", "bowling_alley",
        "adult_gaming_centre", "amusement_arcade",
        "sports_centre", "fitness_centre", "fitness_station",
        "ice_rink", "skate_park", "swimming_pool", "water_park",
    ]
    # Tourism features split similarly: museums/zoos/aquariums can be relations,
    # viewpoints/galleries/attractions are usually nodes
    tourism_area_values = ["museum", "zoo", "aquarium", "theme_park", "amusement_park"]
    tourism_point_values = ["gallery", "attraction", "viewpoint"]
    historic_values = ["monument", "memorial", "ruins", "castle", "fort"]
    sport_values = ["karting"]
    pitch_sports = ["tennis", "basketball", "pickleball", "soccer", "volleyball"]

    parts: List[str] = []
    around = f"around:{radius_m},{lat},{lon}"

    # Areas: query node + way + relation
    for v in leisure_area_values:
        parts.append(f"  node({around})[leisure={v}];")
        parts.append(f"  way({around})[leisure={v}];")
        parts.append(f"  relation({around})[leisure={v}];")
    # Points: query node + way only
    for v in leisure_point_values:
        parts.append(f"  node({around})[leisure={v}];")
        parts.append(f"  way({around})[leisure={v}];")
    # Beach
    parts.append(f"  node({around})[natural=beach];")
    parts.append(f"  way({around})[natural=beach];")
    # Tourism areas
    for v in tourism_area_values:
        parts.append(f"  node({around})[tourism={v}];")
        parts.append(f"  way({around})[tourism={v}];")
        parts.append(f"  relation({around})[tourism={v}];")
    # Tourism points
    for v in tourism_point_values:
        parts.append(f"  node({around})[tourism={v}];")
        parts.append(f"  way({around})[tourism={v}];")
    # Historic — nodes/ways
    for v in historic_values:
        parts.append(f"  node({around})[historic={v}];")
        parts.append(f"  way({around})[historic={v}];")
    # Sport (e.g. karting)
    for v in sport_values:
        parts.append(f"  node({around})[sport={v}];")
        parts.append(f"  way({around})[sport={v}];")
    # leisure=pitch + sport (must have name to filter out random park markings)
    for sport in pitch_sports:
        parts.append(f"  node({around})[leisure=pitch][sport={sport}][name];")
        parts.append(f"  way({around})[leisure=pitch][sport={sport}][name];")

    body = "\n".join(parts)
    return f"""[out:json][timeout:60];
(
{body}
);
out center;
"""


async def _post_overpass(query: str) -> Tuple[int, str, Dict[str, Any]]:
    """Send the Overpass POST request. Tries each mirror in order until one
    returns valid JSON with a non-empty `elements` list (or until all fail).
    Mirrors `curl --data-urlencode data=...` exactly, since
    httpx.post(data={"data": query}) was eating multi-line content.

    Returns: (status_code, raw_text_first_500, parsed_json_or_empty)
    """
    body = urlencode({"data": query})
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "LocalDrift-Wilmington/0.1 (hello@localdrift.app)",
    }

    last_status = 0
    last_preview = ""

    # Force IPv4 by binding to 0.0.0.0 — Render's IPv6 routing has been
    # observed to drop connections to some Overpass mirrors. IPv4 is reliable.
    transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0", retries=1)

    for url in OVERPASS_URLS:
        try:
            async with httpx.AsyncClient(
                timeout=PER_MIRROR_TIMEOUT, transport=transport
            ) as client:
                resp = await client.post(url, content=body, headers=headers)
        except httpx.HTTPError as e:
            log.warning(f"Overpass mirror {url} HTTP error: {e}; trying next")
            last_preview = f"{type(e).__name__}: {e}"
            continue

        text_preview = resp.text[:500] if resp.text else ""
        last_status = resp.status_code
        last_preview = text_preview
        log.info(f"Overpass mirror {url}: status={resp.status_code} bytes={len(resp.content)}")

        if resp.status_code != 200:
            log.warning(f"Overpass mirror {url} non-200 body: {text_preview}; trying next")
            continue

        try:
            data = resp.json()
        except ValueError as e:
            log.warning(f"Overpass mirror {url} JSON parse error: {e}; trying next")
            continue

        # Empty elements means rate-limit / quota answer, not real "nothing here".
        # OSM has hundreds of features in any major US metro radius.
        elements = data.get("elements", [])
        if not elements:
            log.warning(f"Overpass mirror {url} returned 0 elements; trying next")
            continue

        return resp.status_code, text_preview, data

    # All mirrors failed
    return last_status, last_preview, {}


async def _fetch_and_normalize() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Inner helper: hit Overpass, normalize results, return (records, debug_info).
    Both the production path and the debug endpoint use this so we make one
    HTTP call regardless of which entry point you go through."""
    radius_m = int(PILOT_RADIUS_MILES * MILES_TO_METERS)
    query = _build_query(PILOT_LAT, PILOT_LON, radius_m)

    status, preview, data = await _post_overpass(query)
    elements = data.get("elements", []) if isinstance(data, dict) else []

    normalized: List[Dict[str, Any]] = []
    skipped_no_name = 0
    skipped_no_coords = 0
    for raw in elements:
        a = _normalize_attraction(raw)
        if a:
            normalized.append(a)
        else:
            tags = raw.get("tags") or {}
            if not tags.get("name"):
                skipped_no_name += 1
            else:
                skipped_no_coords += 1

    debug = {
        "lat": PILOT_LAT,
        "lon": PILOT_LON,
        "radius_m": radius_m,
        "query_len": len(query),
        "query_first_300": query[:300],
        "http_status": status,
        "response_preview": preview,
        "raw_elements": len(elements),
        "skipped_unnamed": skipped_no_name,
        "skipped_no_coords": skipped_no_coords,
        "normalized": len(normalized),
    }
    log.info(
        f"OSM normalized {debug['normalized']} attractions "
        f"(raw {debug['raw_elements']}, skipped {debug['skipped_unnamed']} unnamed, "
        f"{debug['skipped_no_coords']} no_coords, status={debug['http_status']})"
    )
    return normalized, debug


async def fetch_attractions() -> List[Dict[str, Any]]:
    """Pull attractions in the pilot radius from Overpass."""
    records, _ = await _fetch_and_normalize()
    return records


async def fetch_attractions_with_debug() -> Dict[str, Any]:
    """Used by /api/admin/test-osm — returns full diagnostic info plus a
    sample of records, instead of just the records list."""
    records, debug = await _fetch_and_normalize()
    return {
        **debug,
        "first_5": records[:5],
        "names": [r["name"] for r in records[:30]],
    }


def _normalize_attraction(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tags = raw.get("tags") or {}
    name = tags.get("name")
    if not name:
        return None  # Skip unnamed features (cluttered/low quality)

    # Lat/lon: nodes have direct lat/lon, ways use the `center` block from `out center`
    lat = raw.get("lat") or (raw.get("center") or {}).get("lat")
    lon = raw.get("lon") or (raw.get("center") or {}).get("lon")
    if lat is None or lon is None:
        return None

    # Determine attraction type. Special-case leisure=pitch first since the
    # type depends on the sport= sub-tag (tennis/basketball/pickleball/etc.),
    # which the simple key=value map can't express.
    attraction_type = "landmark"
    amenities: list = []
    mood_tags: list = []

    if tags.get("leisure") == "pitch":
        sport = (tags.get("sport") or "").lower()
        sport_to_type = {
            "tennis":     "tennis_court",
            "basketball": "basketball_court",
            "pickleball": "pickleball_court",
            "soccer":     "soccer_field",
            "volleyball": "volleyball_court",
        }
        if sport in sport_to_type:
            attraction_type = sport_to_type[sport]
            amenities = ["parking"]
            mood_tags = ["fitness", "outdoor"]

    if attraction_type == "landmark":
        for key, value, atype, defaults, moods, _img in OSM_TYPE_MAP:
            if tags.get(key) == value:
                attraction_type = atype
                amenities = list(defaults)
                mood_tags = list(moods)
                break

    # Address — OSM uses `addr:*` tags inconsistently
    address_parts = [
        tags.get("addr:housenumber", ""),
        tags.get("addr:street", ""),
    ]
    address = " ".join(p for p in address_parts if p).strip()
    city = tags.get("addr:city") or ""
    state = tags.get("addr:state") or ""
    zip_code = tags.get("addr:postcode") or ""

    # Description — use tags.description, then tags.note, then a generated summary
    description = (
        tags.get("description")
        or tags.get("note")
        or f"{attraction_type.replace('_', ' ').title()} in the Wilmington area"
    )

    # Website + opening hours when present
    website = tags.get("website") or tags.get("contact:website") or tags.get("url")
    opening_hours = tags.get("opening_hours")

    # Wheelchair accessibility (OSM has clear yes/no/limited tags)
    wheelchair = tags.get("wheelchair")
    if wheelchair == "yes":
        mood_tags.append("wheelchair_accessible")

    # Dog-friendly hint
    if tags.get("dog") == "yes":
        if "dog_friendly" not in mood_tags:
            mood_tags.append("dog_friendly")

    # OSM stable ID: combo of element type + numeric id (e.g. "way/12345")
    osm_id = f"{raw.get('type', 'node')}/{raw.get('id')}"
    osm_url = f"https://www.openstreetmap.org/{osm_id}"

    # is_free heuristic from OSM tags. We can't always know, so use:
    #   - explicit `fee=yes`         → not free
    #   - explicit `fee=no`          → free
    #   - has admission/charge tag   → not free
    #   - parks/beaches without tags → assume free (very high signal in OSM)
    #   - museums without tags       → unknown (None) — most charge admission
    fee_tag = (tags.get("fee") or "").lower()
    has_charge = bool(tags.get("charge") or tags.get("admission"))
    if fee_tag == "yes" or has_charge:
        is_free: Optional[bool] = False
    elif fee_tag == "no":
        is_free = True
    elif attraction_type in ("park", "beach", "playground"):
        is_free = True
    else:
        is_free = None  # Unknown — UI will show "Admission varies" instead of "Free"

    # Pick a type-appropriate stock photo so the Explore grid isn't 300 forests
    image_url = TYPE_STOCK_IMAGES.get(attraction_type, DEFAULT_STOCK_IMAGE)

    return {
        "name": name,
        "description": description,
        "attraction_type": attraction_type,
        "address": address,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "latitude": float(lat),
        "longitude": float(lon),
        "image_url": image_url,
        "hours": {"text": opening_hours} if opening_hours else None,
        "admission_fee": None,
        "is_free": is_free,
        "difficulty_level": None,
        "trail_length": None,
        "estimated_duration": None,
        "amenities": amenities,
        "mood_tags": mood_tags,
        "best_time_to_visit": None,
        "tips": None,
        "website": website,
        "external_url": website or osm_url,
        "_source": "osm",
        "_source_id": osm_id,
        "_source_url": osm_url,
    }
