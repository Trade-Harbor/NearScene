from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/attractions")

# Attraction Models
class AttractionCreate(BaseModel):
    name: str
    description: str
    attraction_type: str  # park, hiking_trail, landmark, museum, beach, etc.
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    image_url: Optional[str] = None
    hours: Optional[dict] = None  # {"monday": {"open": "06:00", "close": "22:00"}, ...}
    admission_fee: Optional[float] = None
    is_free: bool = True
    difficulty_level: Optional[str] = None  # For trails: easy, moderate, difficult, expert
    trail_length: Optional[float] = None  # miles
    estimated_duration: Optional[str] = None  # "2-3 hours"
    amenities: List[str] = []  # ["restrooms", "parking", "picnic_area", "water_fountain"]
    mood_tags: List[str] = []  # ["family_friendly", "dog_friendly", "wheelchair_accessible", "scenic"]
    best_time_to_visit: Optional[str] = None
    tips: Optional[str] = None

class AttractionResponse(BaseModel):
    attraction_id: str
    name: str
    description: str
    attraction_type: str
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    image_url: Optional[str] = None
    hours: Optional[dict] = None
    admission_fee: Optional[float] = None
    # None when admission is unknown (most OSM-imported records). Frontend
    # shows "Admission varies" instead of "Free" in that case.
    is_free: Optional[bool] = None
    difficulty_level: Optional[str] = None
    trail_length: Optional[float] = None
    estimated_duration: Optional[str] = None
    amenities: List[str] = []
    mood_tags: List[str] = []
    best_time_to_visit: Optional[str] = None
    tips: Optional[str] = None
    rating: float = 0.0
    review_count: int = 0
    is_open_now: bool = True
    distance: Optional[float] = None
    website: Optional[str] = None
    source: Optional[str] = None
    external_url: Optional[str] = None
    created_at: datetime

def check_if_open(hours: Optional[dict]) -> bool:
    """Check if attraction is currently open"""
    if not hours:
        return True  # Assume open if no hours specified (outdoor spaces)
    
    now = datetime.now()
    day_name = now.strftime("%A").lower()
    
    if day_name not in hours:
        return True
    
    day_hours = hours[day_name]
    if not day_hours or day_hours.get("closed"):
        return False
    
    try:
        open_time = datetime.strptime(day_hours["open"], "%H:%M").time()
        close_time = datetime.strptime(day_hours["close"], "%H:%M").time()
        current_time = now.time()
        return open_time <= current_time <= close_time
    except:
        return True

ATTRACTION_TYPES = [
    {"value": "park", "label": "Parks"},
    {"value": "hiking_trail", "label": "Hiking Trails"},
    {"value": "landmark", "label": "Landmarks"},
    {"value": "museum", "label": "Museums"},
    {"value": "beach", "label": "Beaches"},
    {"value": "garden", "label": "Gardens"},
    {"value": "viewpoint", "label": "Scenic Viewpoints"},
    {"value": "historic_site", "label": "Historic Sites"},
    {"value": "nature_reserve", "label": "Nature Reserves"},
    {"value": "playground", "label": "Playgrounds"},
]

def setup_routes(db, calculate_distance, get_current_user, get_optional_user):
    
    @router.get("/types")
    async def get_attraction_types():
        return ATTRACTION_TYPES
    
    @router.post("", response_model=AttractionResponse)
    async def create_attraction(data: AttractionCreate, user = Depends(get_current_user)):
        attraction_id = f"attr_{uuid.uuid4().hex[:12]}"
        
        doc = {
            "attraction_id": attraction_id,
            **data.dict(),
            "rating": 0.0,
            "review_count": 0,
            "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.attractions.insert_one(doc)
        
        return AttractionResponse(**{
            **doc,
            "is_open_now": check_if_open(data.hours),
            "created_at": datetime.now(timezone.utc)
        })
    
    @router.get("", response_model=List[AttractionResponse])
    async def get_attractions(
        latitude: Optional[float] = Query(None),
        longitude: Optional[float] = Query(None),
        radius: float = Query(25),
        attraction_type: Optional[str] = Query(None),
        difficulty: Optional[str] = Query(None),
        free_only: bool = Query(False),
        open_now: bool = Query(False),
        mood: Optional[str] = Query(None),
        amenity: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        limit: int = Query(500)
    ):
        query = {}

        if attraction_type:
            query["attraction_type"] = attraction_type
        
        if difficulty:
            query["difficulty_level"] = difficulty
        
        if free_only:
            query["is_free"] = True
        
        if mood:
            query["mood_tags"] = {"$in": [mood]}
        
        if amenity:
            query["amenities"] = {"$in": [amenity]}
        
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
        
        attractions = await db.attractions.find(query, {"_id": 0}).to_list(500)
        
        results = []
        for attr in attractions:
            attr_copy = dict(attr)
            
            if isinstance(attr_copy.get("created_at"), str):
                attr_copy["created_at"] = datetime.fromisoformat(attr_copy["created_at"])

            is_open = check_if_open(attr_copy.get("hours"))
            attr_copy["is_open_now"] = is_open

            # Surface source + external_url for the detail page UI
            attr_copy["source"] = attr_copy.get("_source")
            attr_copy["external_url"] = attr_copy.get("external_url") or attr_copy.get("_source_url")
            
            if open_now and not is_open:
                continue
            
            if latitude and longitude:
                distance = calculate_distance(
                    latitude, longitude,
                    attr_copy["latitude"], attr_copy["longitude"]
                )
                if distance <= radius:
                    attr_copy["distance"] = round(distance, 1)
                    results.append(attr_copy)
            else:
                results.append(attr_copy)
        
        if latitude and longitude:
            results.sort(key=lambda x: x.get("distance", 999))
        else:
            results.sort(key=lambda x: -x.get("rating", 0))

        # Build response items defensively — a single bad record (missing required
        # field, wrong type) shouldn't blank out the whole list. Log + skip instead.
        import logging as _logging
        _log = _logging.getLogger(__name__)
        responses: List[AttractionResponse] = []
        for r in results[:limit]:
            try:
                responses.append(AttractionResponse(**r))
            except Exception as e:
                _log.warning(
                    f"Skipping invalid attraction {r.get('attraction_id', '?')}: {e}"
                )
        return responses
    
    @router.get("/{attraction_id}", response_model=AttractionResponse)
    async def get_attraction(attraction_id: str, latitude: Optional[float] = None, longitude: Optional[float] = None):
        attr = await db.attractions.find_one({"attraction_id": attraction_id}, {"_id": 0})
        if not attr:
            raise HTTPException(status_code=404, detail="Attraction not found")

        if isinstance(attr.get("created_at"), str):
            attr["created_at"] = datetime.fromisoformat(attr["created_at"])

        attr["is_open_now"] = check_if_open(attr.get("hours"))
        attr["source"] = attr.get("_source")
        attr["external_url"] = attr.get("external_url") or attr.get("_source_url")

        if latitude and longitude:
            attr["distance"] = round(calculate_distance(
                latitude, longitude, attr["latitude"], attr["longitude"]
            ), 1)

        return AttractionResponse(**attr)
    
    return router
