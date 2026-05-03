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
from typing import List, Dict, Any, Optional

import httpx

from .utils import PILOT_LAT, PILOT_LON, PILOT_RADIUS_MILES

log = logging.getLogger(__name__)

# Public Overpass API endpoint. Several mirrors exist; pick the most reliable.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

MILES_TO_METERS = 1609.34

# Map OSM tags to NearScene attraction_type. Order matters — first match wins.
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
]


def _build_query(lat: float, lon: float, radius_m: int) -> str:
    """Build an Overpass QL query that pulls all attraction-type nodes/ways
    within the radius. The `out center` clause flattens ways/relations to
    a single representative point so we get clean lat/lon for every result."""
    return f"""
    [out:json][timeout:30];
    (
      node(around:{radius_m},{lat},{lon})[leisure~"^(park|garden|nature_reserve)$"];
      way(around:{radius_m},{lat},{lon})[leisure~"^(park|garden|nature_reserve)$"];
      node(around:{radius_m},{lat},{lon})[natural=beach];
      way(around:{radius_m},{lat},{lon})[natural=beach];
      node(around:{radius_m},{lat},{lon})[tourism~"^(museum|gallery|attraction|viewpoint|zoo|aquarium)$"];
      way(around:{radius_m},{lat},{lon})[tourism~"^(museum|gallery|attraction|viewpoint|zoo|aquarium)$"];
      node(around:{radius_m},{lat},{lon})[historic~"^(monument|memorial|ruins|castle)$"];
      way(around:{radius_m},{lat},{lon})[historic~"^(monument|memorial|ruins|castle)$"];
      node(around:{radius_m},{lat},{lon})[highway=trailhead];
    );
    out center tags;
    """


async def fetch_attractions() -> List[Dict[str, Any]]:
    """Pull attractions in the pilot radius from Overpass."""
    radius_m = int(PILOT_RADIUS_MILES * MILES_TO_METERS)
    query = _build_query(PILOT_LAT, PILOT_LON, radius_m)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        log.error(f"Overpass API error: {e}")
        return []

    elements = data.get("elements", [])
    log.info(f"Overpass returned {len(elements)} raw OSM elements")

    normalized: List[Dict[str, Any]] = []
    for raw in elements:
        a = _normalize_attraction(raw)
        if a:
            normalized.append(a)

    log.info(f"OSM normalized {len(normalized)} attractions")
    return normalized


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

    # Determine attraction type by checking tags against our map
    attraction_type = "landmark"
    amenities: list = []
    mood_tags: list = []
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
        "image_url": None,                # OSM doesn't host images
        "hours": {"text": opening_hours} if opening_hours else None,
        "admission_fee": None,
        "is_free": True,                  # Public OSM-listed places are virtually all free
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
