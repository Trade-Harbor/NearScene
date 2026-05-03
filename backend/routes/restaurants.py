from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter(prefix="/api/restaurants")

# Restaurant Models
class RestaurantCreate(BaseModel):
    name: str
    description: str
    cuisine_type: str
    price_level: int  # 1-4 ($-$$$$)
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    phone: Optional[str] = None
    website: Optional[str] = None
    image_url: Optional[str] = None
    hours: dict  # {"monday": {"open": "11:00", "close": "22:00"}, ...}
    features: List[str] = []  # ["outdoor_seating", "delivery", "takeout", "reservations"]
    mood_tags: List[str] = []  # ["family_friendly", "romantic", "dog_friendly", "vegetarian"]

class RestaurantResponse(BaseModel):
    restaurant_id: str
    name: str
    description: str
    cuisine_type: str
    price_level: int
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    phone: Optional[str] = None
    website: Optional[str] = None
    image_url: Optional[str] = None
    hours: dict
    features: List[str] = []
    mood_tags: List[str] = []
    rating: float = 0.0
    review_count: int = 0
    # is_open_now is None when we don't have hours data (e.g. Yelp's free tier
    # doesn't return hours via search). Frontend hides the open/closed badge
    # in that case rather than misleadingly saying "Closed".
    is_open_now: Optional[bool] = None
    distance: Optional[float] = None
    owner_id: Optional[str] = None
    website: Optional[str] = None
    source: Optional[str] = None
    external_url: Optional[str] = None
    created_at: datetime

def check_if_open(hours: dict) -> bool:
    """Check if restaurant is currently open based on hours"""
    now = datetime.now()
    day_name = now.strftime("%A").lower()
    
    if day_name not in hours:
        return False
    
    day_hours = hours[day_name]
    if not day_hours or day_hours.get("closed"):
        return False
    
    try:
        open_time = datetime.strptime(day_hours["open"], "%H:%M").time()
        close_time = datetime.strptime(day_hours["close"], "%H:%M").time()
        current_time = now.time()
        
        if close_time < open_time:  # Handles overnight hours
            return current_time >= open_time or current_time <= close_time
        return open_time <= current_time <= close_time
    except:
        return False

def setup_routes(db, calculate_distance, get_current_user, get_optional_user):
    
    @router.post("", response_model=RestaurantResponse)
    async def create_restaurant(data: RestaurantCreate, user = Depends(get_current_user)):
        restaurant_id = f"rest_{uuid.uuid4().hex[:12]}"
        
        doc = {
            "restaurant_id": restaurant_id,
            **data.dict(),
            "rating": 0.0,
            "review_count": 0,
            "owner_id": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.restaurants.insert_one(doc)
        
        return RestaurantResponse(**{
            **doc,
            "is_open_now": check_if_open(data.hours),
            "created_at": datetime.now(timezone.utc)
        })
    
    @router.get("", response_model=List[RestaurantResponse])
    async def get_restaurants(
        latitude: Optional[float] = Query(None),
        longitude: Optional[float] = Query(None),
        radius: float = Query(25),
        cuisine: Optional[str] = Query(None),
        price_level: Optional[int] = Query(None),
        open_now: bool = Query(False),
        mood: Optional[str] = Query(None),  # family_friendly, dog_friendly, romantic, etc.
        features: Optional[str] = Query(None),  # outdoor_seating, delivery, etc.
        search: Optional[str] = Query(None),
        limit: int = Query(500)
    ):
        query = {}
        
        if cuisine:
            query["cuisine_type"] = {"$regex": cuisine, "$options": "i"}
        
        if price_level:
            query["price_level"] = price_level
        
        if mood:
            query["mood_tags"] = {"$in": [mood]}
        
        if features:
            query["features"] = {"$in": [features]}
        
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"cuisine_type": {"$regex": search, "$options": "i"}}
            ]
        
        restaurants = await db.restaurants.find(query, {"_id": 0}).to_list(500)
        
        results = []
        for rest in restaurants:
            rest_copy = dict(rest)
            
            if isinstance(rest_copy.get("created_at"), str):
                rest_copy["created_at"] = datetime.fromisoformat(rest_copy["created_at"])

            # Check if open. None when hours unknown (e.g. Yelp-imported records).
            hours = rest_copy.get("hours") or {}
            if hours:
                is_open = check_if_open(hours)
                rest_copy["is_open_now"] = is_open
            else:
                is_open = None
                rest_copy["is_open_now"] = None

            # Also surface the source/external_url so the UI can link out to Yelp
            rest_copy["source"] = rest_copy.get("_source")
            rest_copy["external_url"] = rest_copy.get("_source_url") or rest_copy.get("website")

            if open_now and not is_open:
                continue
            
            # Calculate distance
            if latitude and longitude:
                distance = calculate_distance(
                    latitude, longitude,
                    rest_copy["latitude"], rest_copy["longitude"]
                )
                if distance <= radius:
                    rest_copy["distance"] = round(distance, 1)
                    results.append(rest_copy)
            else:
                results.append(rest_copy)
        
        # Sort by distance or rating
        if latitude and longitude:
            results.sort(key=lambda x: x.get("distance", 999))
        else:
            results.sort(key=lambda x: -x.get("rating", 0))
        
        return [RestaurantResponse(**r) for r in results[:limit]]
    
    @router.get("/{restaurant_id}", response_model=RestaurantResponse)
    async def get_restaurant(restaurant_id: str, latitude: Optional[float] = None, longitude: Optional[float] = None):
        rest = await db.restaurants.find_one({"restaurant_id": restaurant_id}, {"_id": 0})
        if not rest:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        
        if isinstance(rest.get("created_at"), str):
            rest["created_at"] = datetime.fromisoformat(rest["created_at"])
        
        rest["is_open_now"] = check_if_open(rest.get("hours", {}))
        
        if latitude and longitude:
            rest["distance"] = round(calculate_distance(
                latitude, longitude, rest["latitude"], rest["longitude"]
            ), 1)
        
        return RestaurantResponse(**rest)
    
    @router.get("/cuisines/list")
    async def get_cuisines():
        cuisines = await db.restaurants.distinct("cuisine_type")
        return sorted(cuisines)
    
    return router
