"""OpenStreetMap Overpass API ingester for churches and places of worship.

Uses the same multi-mirror, IPv4-forced HTTP setup as osm_attractions.py for
reliability. OSM coverage of churches in the Wilmington area is solid —
denominations are usually tagged, and many entries include website + phone.

Tagged via OSM key `amenity=place_of_worship`. We default-filter to Christian
churches (per the original ask: 'find local churches') but ingest other
religions too with `religion` field surfaced for future filtering.
"""
import logging
from collections import deque
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlencode

import httpx

from .utils import PILOT_LAT, PILOT_LON, PILOT_RADIUS_MILES

log = logging.getLogger(__name__)

# Reuse the same OSM mirror chain as attractions
OVERPASS_URLS = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

PER_MIRROR_TIMEOUT = 30.0
MILES_TO_METERS = 1609.34

# Stock photo per denomination/religion. Rotates the visual so the Churches
# grid isn't 200 of the same stained-glass picture.
DEFAULT_CHURCH_IMAGE = "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800"
DENOMINATION_STOCK_IMAGES = {
    "catholic":  "https://images.unsplash.com/photo-1548276145-69a9521f0499?w=800",  # cathedral interior
    "baptist":   "https://images.unsplash.com/photo-1607000975510-4a8b96e2b6f6?w=800",  # white country church
    "methodist": "https://images.unsplash.com/photo-1473177104440-ffee2f376098?w=800",  # cross + sky
    "lutheran":  "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800",  # generic church exterior
    "presbyterian": "https://images.unsplash.com/photo-1473177104440-ffee2f376098?w=800",
    "pentecostal": "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800",
    "non_denominational": "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800",
    "episcopal": "https://images.unsplash.com/photo-1548276145-69a9521f0499?w=800",
    "anglican":  "https://images.unsplash.com/photo-1548276145-69a9521f0499?w=800",
    "orthodox":  "https://images.unsplash.com/photo-1548276145-69a9521f0499?w=800",
    "mormon":    "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800",
    "jewish":    "https://images.unsplash.com/photo-1559069961-1ed4d80b3878?w=800",  # synagogue
    "muslim":    "https://images.unsplash.com/photo-1542398331-3b8b85f54daf?w=800",  # mosque
    "buddhist":  "https://images.unsplash.com/photo-1545891488-a47b81fa70cb?w=800",  # temple
    "hindu":     "https://images.unsplash.com/photo-1545891488-a47b81fa70cb?w=800",
}


def _build_query(lat: float, lon: float, radius_m: int) -> str:
    """Pull all places of worship (nodes, ways, relations) within radius."""
    around = f"around:{radius_m},{lat},{lon}"
    return f"""[out:json][timeout:60];
(
  node({around})[amenity=place_of_worship];
  way({around})[amenity=place_of_worship];
  relation({around})[amenity=place_of_worship];
);
out center;
"""


async def _post_overpass(query: str) -> Tuple[int, str, Dict[str, Any]]:
    body = urlencode({"data": query})
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "LocalDrift-Wilmington/0.1 (hello@localdrift.app)",
    }
    transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0", retries=1)
    last_status, last_preview = 0, ""
    for url in OVERPASS_URLS:
        try:
            async with httpx.AsyncClient(timeout=PER_MIRROR_TIMEOUT, transport=transport) as client:
                resp = await client.post(url, content=body, headers=headers)
        except httpx.HTTPError as e:
            log.warning(f"Overpass mirror {url} HTTP error: {e}; trying next")
            last_preview = f"{type(e).__name__}: {e}"
            continue
        text_preview = resp.text[:500] if resp.text else ""
        last_status, last_preview = resp.status_code, text_preview
        log.info(f"Overpass mirror {url}: status={resp.status_code} bytes={len(resp.content)}")
        if resp.status_code != 200:
            log.warning(f"Overpass mirror {url} non-200; trying next")
            continue
        try:
            data = resp.json()
        except ValueError as e:
            log.warning(f"Overpass mirror {url} JSON parse error: {e}; trying next")
            continue
        if not data.get("elements"):
            log.warning(f"Overpass mirror {url} returned 0 elements; trying next")
            continue
        return resp.status_code, text_preview, data
    return last_status, last_preview, {}


async def fetch_churches() -> List[Dict[str, Any]]:
    """Pull all places of worship in pilot radius from OSM."""
    radius_m = int(PILOT_RADIUS_MILES * MILES_TO_METERS)
    query = _build_query(PILOT_LAT, PILOT_LON, radius_m)
    status, preview, data = await _post_overpass(query)
    elements = data.get("elements", []) if isinstance(data, dict) else []
    log.info(f"Overpass returned {len(elements)} raw church-type elements")

    normalized: List[Dict[str, Any]] = []
    skipped_no_name = 0
    for raw in elements:
        n = _normalize_church(raw)
        if n:
            normalized.append(n)
        else:
            skipped_no_name += 1

    log.info(f"OSM churches normalized {len(normalized)} (skipped {skipped_no_name} unnamed)")
    return normalized


def _normalize_church(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tags = raw.get("tags") or {}
    name = tags.get("name")
    if not name:
        return None  # skip unnamed nodes

    lat = raw.get("lat") or (raw.get("center") or {}).get("lat")
    lon = raw.get("lon") or (raw.get("center") or {}).get("lon")
    if lat is None or lon is None:
        return None

    religion = (tags.get("religion") or "").lower().strip()
    denomination = (tags.get("denomination") or "").lower().strip()

    # Address from osm tags
    address_parts = [tags.get("addr:housenumber", ""), tags.get("addr:street", "")]
    address = " ".join(p for p in address_parts if p).strip()
    city = tags.get("addr:city") or ""
    state = tags.get("addr:state") or ""
    zip_code = tags.get("addr:postcode") or ""

    # Rich fields when available
    website = tags.get("website") or tags.get("contact:website") or tags.get("url")
    phone = tags.get("phone") or tags.get("contact:phone")
    email = tags.get("email") or tags.get("contact:email")
    opening_hours = tags.get("opening_hours")
    service_times = tags.get("service_times")
    wheelchair = tags.get("wheelchair") == "yes"

    # Pick a stock image based on denomination, falling back to religion, then default
    image_url = (
        DENOMINATION_STOCK_IMAGES.get(denomination)
        or DENOMINATION_STOCK_IMAGES.get(religion)
        or DEFAULT_CHURCH_IMAGE
    )

    description = ""
    if denomination and religion:
        description = f"{denomination.title()} {religion.title()} church"
    elif denomination:
        description = f"{denomination.title()} church"
    elif religion:
        description = f"{religion.title()} place of worship"
    else:
        description = "Local place of worship"

    osm_id = f"{raw.get('type', 'node')}/{raw.get('id')}"
    osm_url = f"https://www.openstreetmap.org/{osm_id}"

    return {
        "name": name,
        "description": description,
        "religion": religion or None,
        "denomination": denomination or None,
        "address": address,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "latitude": float(lat),
        "longitude": float(lon),
        "image_url": image_url,
        "website": website,
        "phone": phone,
        "email": email,
        "opening_hours": opening_hours,
        "service_times": service_times,
        "wheelchair_accessible": wheelchair,
        "external_url": website or osm_url,
        "_source": "osm",
        "_source_id": osm_id,
        "_source_url": osm_url,
    }
