"""Routes for the Churches tab — places of worship discovered via OSM."""
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/churches")
log = logging.getLogger(__name__)


class ChurchResponse(BaseModel):
    church_id: str
    name: str
    description: str
    religion: Optional[str] = None
    denomination: Optional[str] = None
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    image_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    opening_hours: Optional[str] = None
    service_times: Optional[str] = None
    wheelchair_accessible: bool = False
    distance: Optional[float] = None
    source: Optional[str] = None
    external_url: Optional[str] = None
    created_at: datetime


def setup_routes(db, calculate_distance, get_current_user, get_optional_user):
    """Register church routes. Mirrors the pattern used by attractions/restaurants."""

    @router.get("", response_model=List[ChurchResponse])
    async def list_churches(
        latitude: Optional[float] = Query(None),
        longitude: Optional[float] = Query(None),
        radius: float = Query(25),
        religion: Optional[str] = Query(None, description="Filter by religion, e.g. 'christian'"),
        denomination: Optional[str] = Query(None, description="Filter by denomination, e.g. 'baptist'"),
        wheelchair_only: bool = Query(False),
        search: Optional[str] = Query(None),
        limit: int = Query(500),
    ):
        """List churches within radius. Defaults to all religions; use the
        religion or denomination params to narrow down."""
        query: dict = {}
        if religion:
            query["religion"] = religion.lower()
        if denomination:
            query["denomination"] = denomination.lower()
        if wheelchair_only:
            query["wheelchair_accessible"] = True
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"denomination": {"$regex": search, "$options": "i"}},
            ]

        churches = await db.churches.find(query, {"_id": 0}).to_list(2000)

        results = []
        for ch in churches:
            ch_copy = dict(ch)
            if isinstance(ch_copy.get("created_at"), str):
                ch_copy["created_at"] = datetime.fromisoformat(ch_copy["created_at"])
            ch_copy["source"] = ch_copy.get("_source")
            if latitude is not None and longitude is not None:
                d = calculate_distance(latitude, longitude, ch_copy["latitude"], ch_copy["longitude"])
                if d <= radius:
                    ch_copy["distance"] = round(d, 1)
                    results.append(ch_copy)
            else:
                results.append(ch_copy)

        if latitude is not None and longitude is not None:
            results.sort(key=lambda x: x.get("distance", 999))
        else:
            results.sort(key=lambda x: x.get("name", ""))

        responses: List[ChurchResponse] = []
        for r in results[:limit]:
            try:
                responses.append(ChurchResponse(**r))
            except Exception as e:
                log.warning(f"Skipping invalid church {r.get('church_id', '?')}: {e}")
        return responses

    @router.get("/denominations")
    async def get_denominations():
        """List all denomination values seen in the DB, with counts."""
        pipeline = [
            {"$match": {"denomination": {"$ne": None, "$exists": True}}},
            {"$group": {"_id": "$denomination", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        items = []
        async for r in db.churches.aggregate(pipeline):
            items.append({"value": r["_id"], "count": r["count"]})
        return items

    @router.get("/{church_id}", response_model=ChurchResponse)
    async def get_church(church_id: str, latitude: Optional[float] = None, longitude: Optional[float] = None):
        ch = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
        if not ch:
            raise HTTPException(status_code=404, detail="Church not found")
        if isinstance(ch.get("created_at"), str):
            ch["created_at"] = datetime.fromisoformat(ch["created_at"])
        ch["source"] = ch.get("_source")
        if latitude is not None and longitude is not None:
            ch["distance"] = round(
                calculate_distance(latitude, longitude, ch["latitude"], ch["longitude"]), 1
            )
        return ChurchResponse(**ch)

    return router
