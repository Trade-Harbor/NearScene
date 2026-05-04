"""Ingestion runner — orchestrates all sources, dedupes, and inserts into Mongo.

Run via:
  - HTTP admin endpoint:  POST /api/admin/ingest  (auth-protected)
  - Render cron job:       python -m backend.ingestion.runner

Idempotent: re-running won't create duplicates. Same event coming from
two sources (e.g. both Ticketmaster and SeatGeek list the same concert)
is deduped by `event_dedup_key`.

User-submitted events/restaurants are NEVER overwritten — we only touch
records with a `_source` field set to a known external source.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient

from . import ticketmaster, seatgeek, yelp, osm_attractions, news
from .utils import event_dedup_key, event_location_dedup_key, business_dedup_key

log = logging.getLogger(__name__)


def _get_db():
    """Connect to the same Mongo instance the API uses."""
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "nearscene")
    if not mongo_url:
        raise RuntimeError("MONGO_URL is not set")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


async def ingest_events(db, yelp_market_events: Optional[List[Dict[str, Any]]] = None) -> Dict[str, int]:
    """Pull from all event sources, dedupe across sources and against existing data.
    `yelp_market_events` (optional) can be provided so Yelp-derived farmer markets
    flow into the events collection alongside Ticketmaster/SeatGeek concerts."""
    ticketmaster_events, seatgeek_events = await asyncio.gather(
        ticketmaster.fetch_events(),
        seatgeek.fetch_events(),
    )
    candidates = ticketmaster_events + seatgeek_events + (yelp_market_events or [])
    log.info(
        f"Total event candidates: {len(candidates)} "
        f"(tm={len(ticketmaster_events)}, sg={len(seatgeek_events)}, "
        f"markets={len(yelp_market_events or [])})"
    )

    # Each event has TWO dedup keys: title-based and location-based.
    # Skip an event if EITHER key matches an existing record or another
    # event in this batch we've already chosen. Catches both:
    #   - Concert title variance ('Artist - Tour' vs 'Artist')  → title key
    #   - Sports home/away framing (A vs B  vs  B at A)            → location key

    # Dedupe within this batch
    seen_title_keys: Dict[str, Dict[str, Any]] = {}
    seen_loc_keys: Dict[str, str] = {}   # loc_key → title_key chosen for that loc
    chosen: Dict[str, Dict[str, Any]] = {}  # title_key → event

    for ev in candidates:
        tk = event_dedup_key(ev["title"], ev["start_date"], ev["location_name"])
        lk = event_location_dedup_key(ev.get("latitude"), ev.get("longitude"), ev["start_date"])

        # If this location/hour was already represented by a different title,
        # skip OR upgrade to Ticketmaster's version (richer metadata).
        if lk and lk in seen_loc_keys:
            existing_tk = seen_loc_keys[lk]
            if ev["_source"] == "ticketmaster" and chosen.get(existing_tk, {}).get("_source") != "ticketmaster":
                # Upgrade to TM version: drop the old chosen, replace with this one
                chosen.pop(existing_tk, None)
                seen_title_keys.pop(existing_tk, None)
                seen_loc_keys[lk] = tk
                chosen[tk] = ev
                seen_title_keys[tk] = ev
            # Otherwise the location is already covered → skip this candidate
            continue

        # New (lk, tk) combination
        if tk not in chosen or ev["_source"] == "ticketmaster":
            chosen[tk] = ev
            seen_title_keys[tk] = ev
            if lk:
                seen_loc_keys[lk] = tk

    # Dedupe against existing DB records (already-imported events).
    # Pull both _dedup_key and a stored _loc_dedup_key for full coverage.
    existing_title_keys = set()
    existing_loc_keys = set()
    async for doc in db.events.find(
        {"_dedup_key": {"$exists": True}},
        {"_dedup_key": 1, "_loc_dedup_key": 1, "_id": 0},
    ):
        if doc.get("_dedup_key"):
            existing_title_keys.add(doc["_dedup_key"])
        if doc.get("_loc_dedup_key"):
            existing_loc_keys.add(doc["_loc_dedup_key"])

    skipped = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    docs_to_insert: List[Dict[str, Any]] = []

    for tk, ev in chosen.items():
        lk = event_location_dedup_key(ev.get("latitude"), ev.get("longitude"), ev["start_date"])
        if tk in existing_title_keys or (lk and lk in existing_loc_keys):
            skipped += 1
            continue

        event_id = f"event_{uuid.uuid4().hex[:12]}"
        docs_to_insert.append({
            "event_id": event_id,
            **ev,
            "tickets_sold": 0,
            "promotion_expires": None,
            "organizer_id": f"source_{ev['_source']}",
            "organizer_name": ev["_source"].title(),
            "organizer_type": "external",
            "created_at": now_iso,
            "_dedup_key": tk,
            "_loc_dedup_key": lk,
        })

    # Single bulk insert beats N individual inserts on Atlas — round-trip cost dominates
    inserted = 0
    if docs_to_insert:
        result = await db.events.insert_many(docs_to_insert, ordered=False)
        inserted = len(result.inserted_ids)

    log.info(f"Events: inserted={inserted}, skipped_duplicate={skipped}")
    return {"inserted": inserted, "skipped": skipped, "total_candidates": len(candidates)}


async def ingest_yelp(db) -> Dict[str, Any]:
    """Pull from Yelp once, route businesses to restaurants vs. food_trucks
    vs. farmer-market events based on Yelp's category aliases, dedupe each."""
    split = await yelp.fetch_all()
    restaurants_candidates = split["restaurants"]
    food_trucks_candidates = split["food_trucks"]
    market_event_candidates = split.get("market_events", [])
    log.info(
        f"Yelp candidates: restaurants={len(restaurants_candidates)} "
        f"food_trucks={len(food_trucks_candidates)} "
        f"market_events={len(market_event_candidates)}"
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    now_dt = datetime.now(timezone.utc).isoformat()

    # === Restaurants ===
    existing_rest_keys = set()
    async for doc in db.restaurants.find(
        {"_dedup_key": {"$exists": True}}, {"_dedup_key": 1, "_id": 0}
    ):
        existing_rest_keys.add(doc["_dedup_key"])

    rest_skipped = 0
    rest_to_insert: List[Dict[str, Any]] = []
    for r in restaurants_candidates:
        key = business_dedup_key(r["name"], r["address"])
        if key in existing_rest_keys:
            rest_skipped += 1
            continue
        restaurant_id = f"restaurant_{uuid.uuid4().hex[:12]}"
        rest_to_insert.append({
            "restaurant_id": restaurant_id,
            **r,
            "owner_id": f"source_{r['_source']}",
            "owner_name": "Yelp",
            "is_active": True,
            "created_at": now_iso,
            "_dedup_key": key,
        })
    rest_inserted = 0
    if rest_to_insert:
        result = await db.restaurants.insert_many(rest_to_insert, ordered=False)
        rest_inserted = len(result.inserted_ids)

    # === Food trucks ===
    existing_ft_keys = set()
    async for doc in db.food_trucks.find(
        {"_dedup_key": {"$exists": True}}, {"_dedup_key": 1, "_id": 0}
    ):
        existing_ft_keys.add(doc["_dedup_key"])

    ft_skipped = 0
    ft_to_insert: List[Dict[str, Any]] = []
    for ft in food_trucks_candidates:
        key = business_dedup_key(ft["name"], ft["address"])
        if key in existing_ft_keys:
            ft_skipped += 1
            continue
        truck_id = f"truck_{uuid.uuid4().hex[:12]}"
        ft_to_insert.append({
            "truck_id": truck_id,
            **ft,
            "owner_id": f"source_{ft['_source']}",
            "owner_name": "Yelp",
            "is_active_today": True,
            "last_updated": now_dt,
            "created_at": now_iso,
            "_dedup_key": key,
        })
    ft_inserted = 0
    if ft_to_insert:
        result = await db.food_trucks.insert_many(ft_to_insert, ordered=False)
        ft_inserted = len(result.inserted_ids)

    log.info(
        f"Yelp ingest done: restaurants inserted={rest_inserted} skipped={rest_skipped}; "
        f"food_trucks inserted={ft_inserted} skipped={ft_skipped}"
    )
    return {
        "restaurants": {
            "inserted": rest_inserted,
            "skipped": rest_skipped,
            "total_candidates": len(restaurants_candidates),
        },
        "food_trucks": {
            "inserted": ft_inserted,
            "skipped": ft_skipped,
            "total_candidates": len(food_trucks_candidates),
        },
        # Surface raw market-event candidates so run_all can feed them into ingest_events
        "market_events_raw": market_event_candidates,
    }


async def ingest_attractions(db) -> Dict[str, int]:
    """Pull attractions from OSM Overpass, dedupe by name+address, insert.
    Failures are non-fatal — the rest of the ingestion run still completes.
    OSM Overpass is community-run and occasionally unreachable; the daily
    cron will pick up where this leaves off."""
    try:
        candidates = await osm_attractions.fetch_attractions()
    except Exception as e:
        log.error(f"OSM ingestion failed (continuing without attractions): {e}")
        return {"inserted": 0, "skipped": 0, "total_candidates": 0, "error": str(e)}
    log.info(f"Attraction candidates: {len(candidates)}")

    existing_keys = set()
    async for doc in db.attractions.find(
        {"_dedup_key": {"$exists": True}},
        {"_dedup_key": 1, "_id": 0},
    ):
        existing_keys.add(doc["_dedup_key"])

    skipped = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    docs_to_insert: List[Dict[str, Any]] = []

    for a in candidates:
        key = business_dedup_key(a["name"], a["address"])
        if key in existing_keys:
            skipped += 1
            continue

        attraction_id = f"attraction_{uuid.uuid4().hex[:12]}"
        docs_to_insert.append({
            "attraction_id": attraction_id,
            **a,
            "owner_id": f"source_{a['_source']}",
            "owner_name": "OpenStreetMap",
            "rating": 0.0,
            "review_count": 0,
            "created_at": now_iso,
            "_dedup_key": key,
        })

    inserted = 0
    if docs_to_insert:
        result = await db.attractions.insert_many(docs_to_insert, ordered=False)
        inserted = len(result.inserted_ids)

    log.info(f"Attractions: inserted={inserted}, skipped_duplicate={skipped}")
    return {"inserted": inserted, "skipped": skipped, "total_candidates": len(candidates)}


async def ingest_news(db) -> Dict[str, int]:
    """Pull local-area news from Google News RSS, dedupe by article URL, insert.
    Failures are non-fatal."""
    try:
        candidates = await news.fetch_news()
    except Exception as e:
        log.error(f"News ingestion failed: {e}")
        return {"inserted": 0, "skipped": 0, "total_candidates": 0, "error": str(e)}

    existing_urls = set()
    async for doc in db.news.find({"link": {"$exists": True}}, {"link": 1, "_id": 0}):
        existing_urls.add(doc["link"])

    skipped = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    docs_to_insert: List[Dict[str, Any]] = []
    for n in candidates:
        if n["link"] in existing_urls:
            skipped += 1
            continue
        docs_to_insert.append({
            "news_id": f"news_{uuid.uuid4().hex[:12]}",
            **n,
            "ingested_at": now_iso,
        })
    inserted = 0
    if docs_to_insert:
        result = await db.news.insert_many(docs_to_insert, ordered=False)
        inserted = len(result.inserted_ids)
    log.info(f"News: inserted={inserted}, skipped_duplicate={skipped}")
    return {"inserted": inserted, "skipped": skipped, "total_candidates": len(candidates)}


async def run_all() -> Dict[str, Any]:
    """Run every source. Returns a summary.

    Order matters: Yelp runs first because it produces farmer-market candidates
    that we want to feed into ingest_events alongside Ticketmaster + SeatGeek
    (so they appear on the markets tab on the homepage).
    """
    db = _get_db()
    started = datetime.now(timezone.utc)

    yelp_result = await ingest_yelp(db)
    market_events_raw = yelp_result.pop("market_events_raw", [])

    events_result = await ingest_events(db, yelp_market_events=market_events_raw)
    attractions_result = await ingest_attractions(db)
    news_result = await ingest_news(db)

    finished = datetime.now(timezone.utc)
    duration = (finished - started).total_seconds()

    summary = {
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "duration_seconds": round(duration, 1),
        "events": events_result,
        "restaurants": yelp_result["restaurants"],
        "food_trucks": yelp_result["food_trucks"],
        "attractions": attractions_result,
        "news": news_result,
    }

    # Audit log so we can see ingestion history
    await db.ingestion_runs.insert_one({**summary, "_id": uuid.uuid4().hex})
    log.info(f"Ingestion summary: {summary}")
    return summary


if __name__ == "__main__":
    # Allow running as a Render cron job: `python -m ingestion.runner`
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    result = asyncio.run(run_all())
    print(result)
