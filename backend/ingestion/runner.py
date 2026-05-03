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
from typing import Dict, Any, List

from motor.motor_asyncio import AsyncIOMotorClient

from . import ticketmaster, seatgeek, yelp, osm_attractions
from .utils import event_dedup_key, business_dedup_key

log = logging.getLogger(__name__)


def _get_db():
    """Connect to the same Mongo instance the API uses."""
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "nearscene")
    if not mongo_url:
        raise RuntimeError("MONGO_URL is not set")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


async def ingest_events(db) -> Dict[str, int]:
    """Pull from all event sources, dedupe across sources and against existing data."""
    ticketmaster_events, seatgeek_events = await asyncio.gather(
        ticketmaster.fetch_events(),
        seatgeek.fetch_events(),
    )
    candidates = ticketmaster_events + seatgeek_events
    log.info(f"Total event candidates from all sources: {len(candidates)}")

    # Dedupe within this batch (cross-source) by content hash
    seen_keys: Dict[str, Dict[str, Any]] = {}
    for ev in candidates:
        key = event_dedup_key(ev["title"], ev["start_date"], ev["location_name"])
        # Prefer Ticketmaster over SeatGeek when both have the same event
        # (TM tends to have richer venue + image data)
        if key not in seen_keys or ev["_source"] == "ticketmaster":
            seen_keys[key] = ev

    # Dedupe against existing DB records (already-imported events)
    existing_keys = set()
    async for doc in db.events.find(
        {"_dedup_key": {"$exists": True}},
        {"_dedup_key": 1, "_id": 0},
    ):
        existing_keys.add(doc["_dedup_key"])

    inserted = 0
    skipped = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for key, ev in seen_keys.items():
        if key in existing_keys:
            skipped += 1
            continue

        event_id = f"event_{uuid.uuid4().hex[:12]}"
        doc = {
            "event_id": event_id,
            **ev,
            "tickets_sold": 0,
            "promotion_expires": None,
            "organizer_id": f"source_{ev['_source']}",
            "organizer_name": ev["_source"].title(),
            "organizer_type": "external",
            "created_at": now_iso,
            "_dedup_key": key,
        }
        await db.events.insert_one(doc)
        inserted += 1

    log.info(f"Events: inserted={inserted}, skipped_duplicate={skipped}")
    return {"inserted": inserted, "skipped": skipped, "total_candidates": len(candidates)}


async def ingest_restaurants(db) -> Dict[str, int]:
    """Pull restaurants from Yelp, dedupe, and upsert."""
    candidates = await yelp.fetch_restaurants()
    log.info(f"Restaurant candidates: {len(candidates)}")

    existing_keys = set()
    async for doc in db.restaurants.find(
        {"_dedup_key": {"$exists": True}},
        {"_dedup_key": 1, "_id": 0},
    ):
        existing_keys.add(doc["_dedup_key"])

    inserted = 0
    skipped = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for r in candidates:
        key = business_dedup_key(r["name"], r["address"])
        if key in existing_keys:
            skipped += 1
            continue

        restaurant_id = f"restaurant_{uuid.uuid4().hex[:12]}"
        doc = {
            "restaurant_id": restaurant_id,
            **r,
            "owner_id": f"source_{r['_source']}",
            "owner_name": "Yelp",
            "is_active": True,
            "created_at": now_iso,
            "_dedup_key": key,
        }
        await db.restaurants.insert_one(doc)
        inserted += 1

    log.info(f"Restaurants: inserted={inserted}, skipped_duplicate={skipped}")
    return {"inserted": inserted, "skipped": skipped, "total_candidates": len(candidates)}


async def ingest_attractions(db) -> Dict[str, int]:
    """Pull attractions from OSM Overpass, dedupe by name+address, insert."""
    candidates = await osm_attractions.fetch_attractions()
    log.info(f"Attraction candidates: {len(candidates)}")

    existing_keys = set()
    async for doc in db.attractions.find(
        {"_dedup_key": {"$exists": True}},
        {"_dedup_key": 1, "_id": 0},
    ):
        existing_keys.add(doc["_dedup_key"])

    inserted = 0
    skipped = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for a in candidates:
        key = business_dedup_key(a["name"], a["address"])
        if key in existing_keys:
            skipped += 1
            continue

        attraction_id = f"attraction_{uuid.uuid4().hex[:12]}"
        doc = {
            "attraction_id": attraction_id,
            **a,
            "owner_id": f"source_{a['_source']}",
            "owner_name": "OpenStreetMap",
            "rating": 0.0,
            "review_count": 0,
            "created_at": now_iso,
            "_dedup_key": key,
        }
        await db.attractions.insert_one(doc)
        inserted += 1

    log.info(f"Attractions: inserted={inserted}, skipped_duplicate={skipped}")
    return {"inserted": inserted, "skipped": skipped, "total_candidates": len(candidates)}


async def run_all() -> Dict[str, Any]:
    """Run every source. Returns a summary."""
    db = _get_db()
    started = datetime.now(timezone.utc)

    events_result = await ingest_events(db)
    restaurants_result = await ingest_restaurants(db)
    attractions_result = await ingest_attractions(db)

    finished = datetime.now(timezone.utc)
    duration = (finished - started).total_seconds()

    summary = {
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "duration_seconds": round(duration, 1),
        "events": events_result,
        "restaurants": restaurants_result,
        "attractions": attractions_result,
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
