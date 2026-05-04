from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
from math import radians, sin, cos, sqrt, atan2

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168  # 7 days

# Commission rate for ticket sales
COMMISSION_RATE = float(os.environ.get('COMMISSION_RATE', '0.05'))

# Create the main app
app = FastAPI(title="LocalVibe API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth")
events_router = APIRouter(prefix="/api/events")
foodtrucks_router = APIRouter(prefix="/api/foodtrucks")
payments_router = APIRouter(prefix="/api/payments")
ai_router = APIRouter(prefix="/api/ai")
flash_deals_router = APIRouter(prefix="/api/flash-deals")

security = HTTPBearer(auto_error=False)

# ============= MODELS =============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    account_type: str = "personal"  # personal or business
    business_name: Optional[str] = None
    phone: Optional[str] = None
    zip_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    account_type: str
    business_name: Optional[str] = None
    zip_code: Optional[str] = None
    profile_picture: Optional[str] = None
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class EventCategory(BaseModel):
    name: str
    icon: str

class EventCreate(BaseModel):
    title: str
    description: str
    category: str  # concert, parade, marathon, market, happy_hour, garage_sale, food_festival, other
    start_date: datetime
    end_date: Optional[datetime] = None
    location_name: str
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    image_url: Optional[str] = None
    is_paid: bool = False
    ticket_price: Optional[float] = None
    discount_percentage: Optional[float] = None
    total_tickets: Optional[int] = None
    is_promoted: bool = False
    tags: List[str] = []
    mood_tags: List[str] = []  # family_friendly, dog_friendly, outdoor, indoor, free_parking, accessible

class EventResponse(BaseModel):
    event_id: str
    title: str
    description: str
    category: str
    start_date: datetime
    end_date: Optional[datetime] = None
    location_name: str
    address: str
    city: str
    state: str
    zip_code: str
    latitude: float
    longitude: float
    image_url: Optional[str] = None
    is_paid: bool = False
    ticket_price: Optional[float] = None
    discount_percentage: Optional[float] = None
    discounted_price: Optional[float] = None
    total_tickets: Optional[int] = None
    tickets_sold: int = 0
    is_promoted: bool = False
    promotion_expires: Optional[datetime] = None
    tags: List[str] = []
    mood_tags: List[str] = []
    organizer_id: str
    organizer_name: str
    organizer_type: str
    created_at: datetime
    distance: Optional[float] = None
    # External ticketing URL (set when the event was ingested from Ticketmaster,
    # SeatGeek, etc.) — the frontend uses this to link out for ticket purchase
    # instead of running its own Stripe checkout for an event we don't control.
    external_url: Optional[str] = None
    source: Optional[str] = None  # "ticketmaster", "seatgeek", or None for user-submitted

class FoodTruckCreate(BaseModel):
    name: str
    description: str
    cuisine_type: str
    latitude: float
    longitude: float
    address: str
    city: str
    state: str
    zip_code: str
    operating_hours: str
    image_url: Optional[str] = None
    menu_highlights: List[str] = []

class FoodTruckResponse(BaseModel):
    truck_id: str
    name: str
    description: str
    cuisine_type: str
    latitude: float
    longitude: float
    address: str
    city: str
    state: str
    zip_code: str
    operating_hours: str
    image_url: Optional[str] = None
    menu_highlights: List[str] = []
    owner_id: str
    owner_name: str
    rating: float = 0.0
    review_count: int = 0
    is_active_today: bool = True
    last_updated: datetime
    distance: Optional[float] = None

class CommentCreate(BaseModel):
    content: str
    rating: Optional[int] = None  # 1-5 stars

class CommentResponse(BaseModel):
    comment_id: str
    content: str
    rating: Optional[int] = None
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    target_type: str  # event or foodtruck
    target_id: str
    created_at: datetime

class TicketPurchase(BaseModel):
    event_id: str
    quantity: int = 1
    payment_method: str = "stripe"  # stripe or paypal

class TicketResponse(BaseModel):
    ticket_id: str
    event_id: str
    event_title: str
    user_id: str
    quantity: int
    unit_price: float
    total_price: float
    commission: float
    payment_status: str
    payment_method: str
    created_at: datetime

class PromotionCreate(BaseModel):
    event_id: str
    duration_days: int = 7  # promotion duration
    
class PromotionPackage(BaseModel):
    package_id: str
    name: str
    duration_days: int
    price: float
    description: str

class FlashDealCreate(BaseModel):
    event_id: str
    discount_percentage: float  # 0-100
    deal_price: float
    spots_total: Optional[int] = None  # None = unlimited
    end_time: datetime
    description: Optional[str] = None

class FlashDealResponse(BaseModel):
    deal_id: str
    event_id: str
    event_title: str
    event_image: Optional[str] = None
    event_date: datetime
    location_name: str
    city: str
    description: Optional[str] = None
    discount_percentage: float
    deal_price: float
    original_price: float
    business_name: str
    spots_total: Optional[int] = None
    spots_claimed: int = 0
    spots_left: Optional[int] = None
    end_time: datetime
    time_left_seconds: int
    created_at: datetime

# ============= HELPER FUNCTIONS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request, credentials = Depends(security)):
    # Check cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    return user
    
    # Check Bearer token
    if credentials:
        token = credentials.credentials
        payload = decode_token(token)
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    
    raise HTTPException(status_code=401, detail="Not authenticated")

async def get_optional_user(request: Request, credentials = Depends(security)):
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in miles between two coordinates using Haversine formula"""
    R = 3959  # Earth's radius in miles
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

# ============= AUTH ROUTES =============

@auth_router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "password": hashed_pw,
        "name": user_data.name,
        "account_type": user_data.account_type,
        "business_name": user_data.business_name,
        "phone": user_data.phone,
        "zip_code": user_data.zip_code,
        "profile_picture": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            user_id=user_id,
            email=user_data.email,
            name=user_data.name,
            account_type=user_data.account_type,
            business_name=user_data.business_name,
            zip_code=user_data.zip_code,
            profile_picture=None,
            created_at=datetime.now(timezone.utc)
        )
    )

@auth_router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["user_id"], user["email"])
    
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            user_id=user["user_id"],
            email=user["email"],
            name=user["name"],
            account_type=user.get("account_type", "personal"),
            business_name=user.get("business_name"),
            zip_code=user.get("zip_code"),
            profile_picture=user.get("profile_picture"),
            created_at=created_at
        )
    )

# Emergent OAuth session endpoint removed. To re-add Google login, integrate
# Google Identity Services directly with `google-auth` library here.

@auth_router.get("/me", response_model=UserResponse)
async def get_me(user = Depends(get_current_user)):
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        name=user["name"],
        account_type=user.get("account_type", "personal"),
        business_name=user.get("business_name"),
        zip_code=user.get("zip_code"),
        profile_picture=user.get("profile_picture"),
        created_at=created_at
    )

@auth_router.post("/logout")
async def logout(request: Request, response_obj = None):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    return {"message": "Logged out"}

# ============= EVENT ROUTES =============

EVENT_CATEGORIES = [
    {"name": "concert", "label": "Concerts", "icon": "Music"},
    {"name": "parade", "label": "Parades", "icon": "Flag"},
    {"name": "marathon", "label": "Marathons", "icon": "Timer"},
    {"name": "market", "label": "Markets", "icon": "ShoppingBag"},
    {"name": "happy_hour", "label": "Happy Hours", "icon": "Wine"},
    {"name": "garage_sale", "label": "Garage Sales", "icon": "Tag"},
    {"name": "food_festival", "label": "Food Festivals", "icon": "UtensilsCrossed"},
    {"name": "community", "label": "Community Events", "icon": "Users"},
    {"name": "sports", "label": "Sports", "icon": "Trophy"},
    {"name": "other", "label": "Other", "icon": "Calendar"},
]

@events_router.get("/categories")
async def get_categories():
    return EVENT_CATEGORIES

@events_router.post("", response_model=EventResponse)
async def create_event(event_data: EventCreate, user = Depends(get_current_user)):
    event_id = f"event_{uuid.uuid4().hex[:12]}"
    
    discounted_price = None
    if event_data.is_paid and event_data.ticket_price and event_data.discount_percentage:
        discounted_price = round(event_data.ticket_price * (1 - event_data.discount_percentage / 100), 2)
    
    event_doc = {
        "event_id": event_id,
        "title": event_data.title,
        "description": event_data.description,
        "category": event_data.category,
        "start_date": event_data.start_date.isoformat(),
        "end_date": event_data.end_date.isoformat() if event_data.end_date else None,
        "location_name": event_data.location_name,
        "address": event_data.address,
        "city": event_data.city,
        "state": event_data.state,
        "zip_code": event_data.zip_code,
        "latitude": event_data.latitude,
        "longitude": event_data.longitude,
        "image_url": event_data.image_url,
        "is_paid": event_data.is_paid,
        "ticket_price": event_data.ticket_price,
        "discount_percentage": event_data.discount_percentage,
        "discounted_price": discounted_price,
        "total_tickets": event_data.total_tickets,
        "tickets_sold": 0,
        "is_promoted": event_data.is_promoted,
        "promotion_expires": None,
        "tags": event_data.tags,
        "mood_tags": event_data.mood_tags,
        "organizer_id": user["user_id"],
        "organizer_name": user.get("business_name") or user["name"],
        "organizer_type": user.get("account_type", "personal"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.events.insert_one(event_doc)
    
    return EventResponse(**{
        **event_doc,
        "start_date": event_data.start_date,
        "end_date": event_data.end_date,
        "created_at": datetime.now(timezone.utc)
    })

@events_router.get("", response_model=List[EventResponse])
async def get_events(
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius: float = Query(25, description="Radius in miles"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    is_free: Optional[bool] = Query(None),
    mood: Optional[str] = Query(None),  # family_friendly, dog_friendly, outdoor, etc.
    promoted_only: bool = Query(False),
    limit: int = Query(50),
    offset: int = Query(0)
):
    query = {}
    
    # Filter by category
    if category:
        query["category"] = category
    
    # Filter by mood tags
    if mood:
        query["mood_tags"] = {"$in": [mood]}
    
    # Filter by search term
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search.lower()]}}
        ]
    
    # Filter by date range
    if start_date:
        query["start_date"] = {"$gte": start_date}
    if end_date:
        if "start_date" in query:
            query["start_date"]["$lte"] = end_date
        else:
            query["start_date"] = {"$lte": end_date}
    
    # Filter by price
    if is_free is not None:
        query["is_paid"] = not is_free
    
    # Filter promoted events
    if promoted_only:
        query["is_promoted"] = True
        query["$or"] = query.get("$or", []) + [
            {"promotion_expires": {"$gt": datetime.now(timezone.utc).isoformat()}},
            {"promotion_expires": None, "is_promoted": True}
        ]
    
    # Only show upcoming or ongoing events
    query["start_date"] = {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    
    cursor = db.events.find(query, {"_id": 0})
    events = await cursor.to_list(1000)
    
    # Calculate distance and filter by radius if coordinates provided
    results = []
    for event in events:
        event_copy = dict(event)
        
        # Parse dates
        if isinstance(event_copy["start_date"], str):
            event_copy["start_date"] = datetime.fromisoformat(event_copy["start_date"])
        if event_copy.get("end_date") and isinstance(event_copy["end_date"], str):
            event_copy["end_date"] = datetime.fromisoformat(event_copy["end_date"])
        if isinstance(event_copy["created_at"], str):
            event_copy["created_at"] = datetime.fromisoformat(event_copy["created_at"])
        if event_copy.get("promotion_expires") and isinstance(event_copy["promotion_expires"], str):
            event_copy["promotion_expires"] = datetime.fromisoformat(event_copy["promotion_expires"])
        
        if latitude and longitude:
            distance = calculate_distance(
                latitude, longitude,
                event["latitude"], event["longitude"]
            )
            if distance <= radius:
                event_copy["distance"] = round(distance, 1)
                results.append(event_copy)
        else:
            results.append(event_copy)
    
    # Sort: promoted first, then by start date
    results.sort(key=lambda x: (not x.get("is_promoted", False), x["start_date"]))
    
    # Apply pagination
    paginated = results[offset:offset + limit]
    
    return [EventResponse(**e) for e in paginated]

@events_router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: str, latitude: Optional[float] = None, longitude: Optional[float] = None):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Parse dates
    if isinstance(event["start_date"], str):
        event["start_date"] = datetime.fromisoformat(event["start_date"])
    if event.get("end_date") and isinstance(event["end_date"], str):
        event["end_date"] = datetime.fromisoformat(event["end_date"])
    if isinstance(event["created_at"], str):
        event["created_at"] = datetime.fromisoformat(event["created_at"])
    if event.get("promotion_expires") and isinstance(event["promotion_expires"], str):
        event["promotion_expires"] = datetime.fromisoformat(event["promotion_expires"])
    
    # Calculate distance if coordinates provided
    if latitude and longitude:
        event["distance"] = round(calculate_distance(
            latitude, longitude,
            event["latitude"], event["longitude"]
        ), 1)
    
    return EventResponse(**event)

@events_router.put("/{event_id}", response_model=EventResponse)
async def update_event(event_id: str, event_data: EventCreate, user = Depends(get_current_user)):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["organizer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    discounted_price = None
    if event_data.is_paid and event_data.ticket_price and event_data.discount_percentage:
        discounted_price = round(event_data.ticket_price * (1 - event_data.discount_percentage / 100), 2)
    
    update_data = {
        "title": event_data.title,
        "description": event_data.description,
        "category": event_data.category,
        "start_date": event_data.start_date.isoformat(),
        "end_date": event_data.end_date.isoformat() if event_data.end_date else None,
        "location_name": event_data.location_name,
        "address": event_data.address,
        "city": event_data.city,
        "state": event_data.state,
        "zip_code": event_data.zip_code,
        "latitude": event_data.latitude,
        "longitude": event_data.longitude,
        "image_url": event_data.image_url,
        "is_paid": event_data.is_paid,
        "ticket_price": event_data.ticket_price,
        "discount_percentage": event_data.discount_percentage,
        "discounted_price": discounted_price,
        "total_tickets": event_data.total_tickets,
        "tags": event_data.tags
    }
    
    await db.events.update_one({"event_id": event_id}, {"$set": update_data})
    
    updated_event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    
    # Parse dates
    if isinstance(updated_event["start_date"], str):
        updated_event["start_date"] = datetime.fromisoformat(updated_event["start_date"])
    if updated_event.get("end_date") and isinstance(updated_event["end_date"], str):
        updated_event["end_date"] = datetime.fromisoformat(updated_event["end_date"])
    if isinstance(updated_event["created_at"], str):
        updated_event["created_at"] = datetime.fromisoformat(updated_event["created_at"])
    
    return EventResponse(**updated_event)

@events_router.delete("/{event_id}")
async def delete_event(event_id: str, user = Depends(get_current_user)):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["organizer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.events.delete_one({"event_id": event_id})
    return {"message": "Event deleted"}

@events_router.get("/user/my-events", response_model=List[EventResponse])
async def get_my_events(user = Depends(get_current_user)):
    events = await db.events.find({"organizer_id": user["user_id"]}, {"_id": 0}).to_list(100)
    
    results = []
    for event in events:
        if isinstance(event["start_date"], str):
            event["start_date"] = datetime.fromisoformat(event["start_date"])
        if event.get("end_date") and isinstance(event["end_date"], str):
            event["end_date"] = datetime.fromisoformat(event["end_date"])
        if isinstance(event["created_at"], str):
            event["created_at"] = datetime.fromisoformat(event["created_at"])
        results.append(EventResponse(**event))
    
    return results

# ============= FOOD TRUCK ROUTES =============

@foodtrucks_router.post("", response_model=FoodTruckResponse)
async def create_food_truck(truck_data: FoodTruckCreate, user = Depends(get_current_user)):
    truck_id = f"truck_{uuid.uuid4().hex[:12]}"
    
    truck_doc = {
        "truck_id": truck_id,
        "name": truck_data.name,
        "description": truck_data.description,
        "cuisine_type": truck_data.cuisine_type,
        "latitude": truck_data.latitude,
        "longitude": truck_data.longitude,
        "address": truck_data.address,
        "city": truck_data.city,
        "state": truck_data.state,
        "zip_code": truck_data.zip_code,
        "operating_hours": truck_data.operating_hours,
        "image_url": truck_data.image_url,
        "menu_highlights": truck_data.menu_highlights,
        "owner_id": user["user_id"],
        "owner_name": user.get("business_name") or user["name"],
        "rating": 0.0,
        "review_count": 0,
        "is_active_today": True,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    
    await db.food_trucks.insert_one(truck_doc)
    
    return FoodTruckResponse(**{
        **truck_doc,
        "last_updated": datetime.now(timezone.utc)
    })

@foodtrucks_router.get("", response_model=List[FoodTruckResponse])
async def get_food_trucks(
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius: float = Query(25),
    cuisine: Optional[str] = Query(None),
    active_only: bool = Query(True)
):
    query = {}
    
    if cuisine:
        query["cuisine_type"] = {"$regex": cuisine, "$options": "i"}
    
    if active_only:
        query["is_active_today"] = True
    
    trucks = await db.food_trucks.find(query, {"_id": 0}).to_list(500)
    
    results = []
    for truck in trucks:
        truck_copy = dict(truck)
        
        if isinstance(truck_copy["last_updated"], str):
            truck_copy["last_updated"] = datetime.fromisoformat(truck_copy["last_updated"])
        
        if latitude and longitude:
            distance = calculate_distance(
                latitude, longitude,
                truck["latitude"], truck["longitude"]
            )
            if distance <= radius:
                truck_copy["distance"] = round(distance, 1)
                results.append(truck_copy)
        else:
            results.append(truck_copy)
    
    # Sort by distance if coordinates provided
    if latitude and longitude:
        results.sort(key=lambda x: x.get("distance", 999))
    
    return [FoodTruckResponse(**t) for t in results]

@foodtrucks_router.get("/{truck_id}", response_model=FoodTruckResponse)
async def get_food_truck(truck_id: str):
    truck = await db.food_trucks.find_one({"truck_id": truck_id}, {"_id": 0})
    if not truck:
        raise HTTPException(status_code=404, detail="Food truck not found")
    
    if isinstance(truck["last_updated"], str):
        truck["last_updated"] = datetime.fromisoformat(truck["last_updated"])
    
    return FoodTruckResponse(**truck)

@foodtrucks_router.put("/{truck_id}/location")
async def update_food_truck_location(
    truck_id: str,
    latitude: float,
    longitude: float,
    address: str,
    user = Depends(get_current_user)
):
    truck = await db.food_trucks.find_one({"truck_id": truck_id}, {"_id": 0})
    if not truck:
        raise HTTPException(status_code=404, detail="Food truck not found")
    
    if truck["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.food_trucks.update_one(
        {"truck_id": truck_id},
        {"$set": {
            "latitude": latitude,
            "longitude": longitude,
            "address": address,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Location updated"}

@foodtrucks_router.put("/{truck_id}/status")
async def toggle_food_truck_status(truck_id: str, is_active: bool, user = Depends(get_current_user)):
    truck = await db.food_trucks.find_one({"truck_id": truck_id}, {"_id": 0})
    if not truck:
        raise HTTPException(status_code=404, detail="Food truck not found")
    
    if truck["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.food_trucks.update_one(
        {"truck_id": truck_id},
        {"$set": {"is_active_today": is_active, "last_updated": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Status updated to {'active' if is_active else 'inactive'}"}

# ============= COMMENTS & REVIEWS =============

@api_router.post("/comments", response_model=CommentResponse)
async def create_comment(
    target_type: str,  # event or foodtruck
    target_id: str,
    comment_data: CommentCreate,
    user = Depends(get_current_user)
):
    # Verify target exists
    if target_type == "event":
        target = await db.events.find_one({"event_id": target_id}, {"_id": 0})
    elif target_type == "foodtruck":
        target = await db.food_trucks.find_one({"truck_id": target_id}, {"_id": 0})
    else:
        raise HTTPException(status_code=400, detail="Invalid target type")
    
    if not target:
        raise HTTPException(status_code=404, detail=f"{target_type.capitalize()} not found")
    
    comment_id = f"comment_{uuid.uuid4().hex[:12]}"
    
    comment_doc = {
        "comment_id": comment_id,
        "content": comment_data.content,
        "rating": comment_data.rating,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "user_picture": user.get("profile_picture"),
        "target_type": target_type,
        "target_id": target_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.comments.insert_one(comment_doc)
    
    # Update average rating for food trucks
    if target_type == "foodtruck" and comment_data.rating:
        comments = await db.comments.find(
            {"target_type": "foodtruck", "target_id": target_id, "rating": {"$ne": None}},
            {"_id": 0, "rating": 1}
        ).to_list(1000)
        
        if comments:
            avg_rating = sum(c["rating"] for c in comments) / len(comments)
            await db.food_trucks.update_one(
                {"truck_id": target_id},
                {"$set": {"rating": round(avg_rating, 1), "review_count": len(comments)}}
            )
    
    return CommentResponse(**{
        **comment_doc,
        "created_at": datetime.now(timezone.utc)
    })

@api_router.get("/comments/{target_type}/{target_id}", response_model=List[CommentResponse])
async def get_comments(target_type: str, target_id: str):
    comments = await db.comments.find(
        {"target_type": target_type, "target_id": target_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    results = []
    for comment in comments:
        if isinstance(comment["created_at"], str):
            comment["created_at"] = datetime.fromisoformat(comment["created_at"])
        results.append(CommentResponse(**comment))
    
    return results

# ============= PAYMENTS & TICKETS =============

PROMOTION_PACKAGES = [
    {"package_id": "promo_basic", "name": "Basic Boost", "duration_days": 3, "price": 9.99, "description": "3 days of featured placement"},
    {"package_id": "promo_standard", "name": "Standard Boost", "duration_days": 7, "price": 19.99, "description": "7 days of featured placement"},
    {"package_id": "promo_premium", "name": "Premium Boost", "duration_days": 14, "price": 34.99, "description": "14 days of premium featured placement"},
]

@payments_router.get("/promotion-packages")
async def get_promotion_packages():
    return PROMOTION_PACKAGES

@payments_router.post("/checkout/ticket")
async def create_ticket_checkout(purchase: TicketPurchase, request: Request, user = Depends(get_current_user)):
    event = await db.events.find_one({"event_id": purchase.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event.get("is_paid"):
        raise HTTPException(status_code=400, detail="This is a free event")
    
    # Check ticket availability
    tickets_available = (event.get("total_tickets") or 0) - (event.get("tickets_sold") or 0)
    if tickets_available < purchase.quantity:
        raise HTTPException(status_code=400, detail="Not enough tickets available")
    
    # Calculate price
    unit_price = event.get("discounted_price") or event.get("ticket_price")
    total_price = round(unit_price * purchase.quantity, 2)
    commission = round(total_price * COMMISSION_RATE, 2)
    
    # Get origin URL from frontend
    origin_url = request.headers.get("Origin") or request.headers.get("Referer", "").rstrip("/")
    if not origin_url:
        origin_url = str(request.base_url).rstrip("/")
    
    # Create payment transaction
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    ticket_id = f"ticket_{uuid.uuid4().hex[:12]}"
    
    transaction_doc = {
        "transaction_id": transaction_id,
        "ticket_id": ticket_id,
        "event_id": purchase.event_id,
        "event_title": event["title"],
        "user_id": user["user_id"],
        "quantity": purchase.quantity,
        "unit_price": unit_price,
        "total_price": total_price,
        "commission": commission,
        "payment_method": purchase.payment_method,
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_doc)
    
    if purchase.payment_method == "stripe":
        import stripe_helper

        success_url = f"{origin_url}/tickets/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/events/{purchase.event_id}"

        session = stripe_helper.create_checkout_session(
            amount=float(total_price),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "transaction_id": transaction_id,
                "ticket_id": ticket_id,
                "event_id": purchase.event_id,
                "user_id": user["user_id"],
                "type": "ticket",
            },
            product_name=f"Ticket: {event['title']}",
        )

        await db.payment_transactions.update_one(
            {"transaction_id": transaction_id},
            {"$set": {"session_id": session.session_id}}
        )

        return {"checkout_url": session.url, "session_id": session.session_id}
    
    else:  # PayPal
        return {
            "transaction_id": transaction_id,
            "total_price": total_price,
            "payment_method": "paypal"
        }

@payments_router.post("/checkout/promotion")
async def create_promotion_checkout(
    event_id: str,
    package_id: str,
    request: Request,
    user = Depends(get_current_user)
):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["organizer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find package
    package = next((p for p in PROMOTION_PACKAGES if p["package_id"] == package_id), None)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    origin_url = request.headers.get("Origin") or request.headers.get("Referer", "").rstrip("/")
    if not origin_url:
        origin_url = str(request.base_url).rstrip("/")
    
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    
    transaction_doc = {
        "transaction_id": transaction_id,
        "event_id": event_id,
        "user_id": user["user_id"],
        "package_id": package_id,
        "amount": package["price"],
        "duration_days": package["duration_days"],
        "payment_status": "pending",
        "type": "promotion",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_doc)

    import stripe_helper

    success_url = f"{origin_url}/dashboard?promotion=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/dashboard"

    session = stripe_helper.create_checkout_session(
        amount=float(package["price"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "transaction_id": transaction_id,
            "event_id": event_id,
            "user_id": user["user_id"],
            "package_id": package_id,
            "duration_days": str(package["duration_days"]),
            "type": "promotion",
        },
        product_name=f"Promotion: {package['name']}",
    )

    await db.payment_transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"session_id": session.session_id}}
    )

    return {"checkout_url": session.url, "session_id": session.session_id}

@payments_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    import stripe_helper

    status = stripe_helper.get_checkout_status(session_id)
    
    # Update transaction if paid
    if status.payment_status == "paid":
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        
        if transaction and transaction.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid"}}
            )
            
            # Handle ticket purchase
            if transaction.get("type") != "promotion" and transaction.get("ticket_id"):
                # Create ticket record
                ticket_doc = {
                    "ticket_id": transaction["ticket_id"],
                    "event_id": transaction["event_id"],
                    "event_title": transaction["event_title"],
                    "user_id": transaction["user_id"],
                    "quantity": transaction["quantity"],
                    "unit_price": transaction["unit_price"],
                    "total_price": transaction["total_price"],
                    "commission": transaction["commission"],
                    "payment_status": "paid",
                    "payment_method": transaction["payment_method"],
                    "created_at": transaction["created_at"]
                }
                await db.tickets.insert_one(ticket_doc)
                
                # Update tickets sold
                await db.events.update_one(
                    {"event_id": transaction["event_id"]},
                    {"$inc": {"tickets_sold": transaction["quantity"]}}
                )
            
            # Handle promotion purchase
            elif transaction.get("type") == "promotion":
                duration_days = int(transaction.get("duration_days", 7))
                promotion_expires = datetime.now(timezone.utc) + timedelta(days=duration_days)
                
                await db.events.update_one(
                    {"event_id": transaction["event_id"]},
                    {"$set": {
                        "is_promoted": True,
                        "promotion_expires": promotion_expires.isoformat()
                    }}
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    import stripe_helper

    body = await request.body()

    try:
        webhook_response = stripe_helper.handle_webhook(
            body, request.headers.get("Stripe-Signature")
        )

        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid"}}
            )

        return {"status": "processed"}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"status": "error"}

@payments_router.get("/my-tickets", response_model=List[TicketResponse])
async def get_my_tickets(user = Depends(get_current_user)):
    tickets = await db.tickets.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    
    results = []
    for ticket in tickets:
        if isinstance(ticket["created_at"], str):
            ticket["created_at"] = datetime.fromisoformat(ticket["created_at"])
        results.append(TicketResponse(**ticket))
    
    return results

# ============= AI RECOMMENDATIONS =============

@ai_router.post("/recommend")
async def get_recommendations(
    latitude: float,
    longitude: float,
    preferences: Optional[List[str]] = None,
    user = Depends(get_optional_user)
):
    """Recommend nearby events. AI summary disabled in v1 — distance-sorted only.
    To re-enable, integrate Google Gemini directly via `google-genai` here."""
    events = await db.events.find({}, {"_id": 0}).to_list(50)

    nearby_events = []
    for event in events:
        distance = calculate_distance(latitude, longitude, event["latitude"], event["longitude"])
        if distance <= 50:
            event["distance"] = round(distance, 1)
            nearby_events.append(event)

    nearby_events.sort(key=lambda x: x["distance"])
    nearby_events = nearby_events[:5]

    if not nearby_events:
        return {"recommendations": [], "message": "No events found nearby"}

    return {
        "recommendations": [e["event_id"] for e in nearby_events],
        "events": nearby_events,
    }

@ai_router.post("/search")
async def ai_search(query: str, latitude: Optional[float] = None, longitude: Optional[float] = None):
    """Keyword search across events. AI query parsing disabled in v1.
    To re-enable, integrate Google Gemini directly via `google-genai` here."""
    keywords = [k for k in query.split() if k]

    db_query = {}
    if keywords:
        regex = "|".join(keywords)
        db_query["$or"] = [
            {"title": {"$regex": regex, "$options": "i"}},
            {"description": {"$regex": regex, "$options": "i"}},
            {"tags": {"$in": [k.lower() for k in keywords]}},
        ]

    events = await db.events.find(db_query, {"_id": 0}).to_list(20)

    results = []
    for event in events:
        if isinstance(event.get("start_date"), str):
            event["start_date"] = datetime.fromisoformat(event["start_date"])
        if event.get("end_date") and isinstance(event["end_date"], str):
            event["end_date"] = datetime.fromisoformat(event["end_date"])
        if isinstance(event.get("created_at"), str):
            event["created_at"] = datetime.fromisoformat(event["created_at"])

        if latitude is not None and longitude is not None:
            event["distance"] = round(calculate_distance(
                latitude, longitude, event["latitude"], event["longitude"]
            ), 1)

        results.append(event)

    return {"events": results, "search_params": {"keywords": keywords}}

# ============= FLASH DEALS =============

def _to_flash_deal_response(deal: dict) -> dict:
    """Compute derived fields (time_left_seconds, spots_left) on a deal doc."""
    end_time = deal.get("end_time")
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    time_left = int((end_time - datetime.now(timezone.utc)).total_seconds())

    spots_total = deal.get("spots_total")
    spots_claimed = deal.get("spots_claimed", 0)
    spots_left = (spots_total - spots_claimed) if spots_total is not None else None

    event_date = deal.get("event_date")
    if isinstance(event_date, str):
        event_date = datetime.fromisoformat(event_date)

    created_at = deal.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)

    return {
        "deal_id": deal["deal_id"],
        "event_id": deal["event_id"],
        "event_title": deal.get("event_title", ""),
        "event_image": deal.get("event_image"),
        "event_date": event_date,
        "location_name": deal.get("location_name", ""),
        "city": deal.get("city", ""),
        "description": deal.get("description"),
        "discount_percentage": deal.get("discount_percentage", 0.0),
        "deal_price": deal.get("deal_price", 0.0),
        "original_price": deal.get("original_price", 0.0),
        "business_name": deal.get("business_name", ""),
        "spots_total": spots_total,
        "spots_claimed": spots_claimed,
        "spots_left": spots_left,
        "end_time": end_time,
        "time_left_seconds": max(0, time_left),
        "created_at": created_at,
    }


@flash_deals_router.get("", response_model=List[FlashDealResponse])
async def list_flash_deals(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: float = 50.0,
    active_only: bool = True,
    limit: int = 50,
):
    """List flash deals, optionally filtered by location and active status."""
    query: Dict[str, Any] = {}
    if active_only:
        query["end_time"] = {"$gt": datetime.now(timezone.utc).isoformat()}

    deals = await db.flash_deals.find(query, {"_id": 0}).to_list(500)

    results = []
    for deal in deals:
        # Skip sold-out deals when active_only
        if active_only and deal.get("spots_total") is not None:
            if deal.get("spots_claimed", 0) >= deal["spots_total"]:
                continue

        # Optional radius filter using stored lat/lon
        if latitude is not None and longitude is not None:
            d_lat = deal.get("latitude")
            d_lon = deal.get("longitude")
            if d_lat is not None and d_lon is not None:
                distance = calculate_distance(latitude, longitude, d_lat, d_lon)
                if distance > radius:
                    continue

        results.append(_to_flash_deal_response(deal))

    # Sort by ending soonest first
    results.sort(key=lambda d: d["time_left_seconds"])
    return results[:limit]


@flash_deals_router.post("", response_model=FlashDealResponse)
async def create_flash_deal(data: FlashDealCreate, user = Depends(get_current_user)):
    """Create a flash deal for an event you organize. Business accounts only."""
    event = await db.events.find_one({"event_id": data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["organizer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="You don't organize this event")

    if not event.get("is_paid") or not event.get("ticket_price"):
        raise HTTPException(status_code=400, detail="Flash deals require a paid event with a ticket price")

    if not (0 < data.discount_percentage <= 100):
        raise HTTPException(status_code=400, detail="discount_percentage must be between 0 and 100")

    end_time = data.end_time
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)
    if end_time <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="end_time must be in the future")

    deal_id = f"deal_{uuid.uuid4().hex[:12]}"
    business_name = user.get("business_name") or user.get("name", "Business")

    deal_doc = {
        "deal_id": deal_id,
        "event_id": data.event_id,
        "event_title": event["title"],
        "event_image": event.get("image_url"),
        "event_date": event["start_date"],
        "location_name": event["location_name"],
        "city": event["city"],
        "latitude": event["latitude"],
        "longitude": event["longitude"],
        "description": data.description,
        "discount_percentage": data.discount_percentage,
        "deal_price": data.deal_price,
        "original_price": event["ticket_price"],
        "business_name": business_name,
        "business_id": user["user_id"],
        "spots_total": data.spots_total,
        "spots_claimed": 0,
        "end_time": end_time.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.flash_deals.insert_one(deal_doc)
    return _to_flash_deal_response(deal_doc)


@flash_deals_router.post("/{deal_id}/claim")
async def claim_flash_deal(deal_id: str, user = Depends(get_current_user)):
    """Reserve a flash deal for the current user. Valid for 24 hours."""
    deal = await db.flash_deals.find_one({"deal_id": deal_id}, {"_id": 0})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Check expiry
    end_time = deal["end_time"]
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)
    if end_time <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This deal has expired")

    # Check capacity
    if deal.get("spots_total") is not None:
        if deal.get("spots_claimed", 0) >= deal["spots_total"]:
            raise HTTPException(status_code=400, detail="This deal is sold out")

    # Check duplicate claim
    existing = await db.flash_deal_claims.find_one(
        {"deal_id": deal_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already claimed this deal")

    claim_id = f"claim_{uuid.uuid4().hex[:12]}"
    claim_expires = datetime.now(timezone.utc) + timedelta(hours=24)

    await db.flash_deal_claims.insert_one({
        "claim_id": claim_id,
        "deal_id": deal_id,
        "user_id": user["user_id"],
        "event_id": deal["event_id"],
        "deal_price": deal["deal_price"],
        "claimed_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": claim_expires.isoformat(),
        "redeemed": False,
    })

    await db.flash_deals.update_one(
        {"deal_id": deal_id},
        {"$inc": {"spots_claimed": 1}}
    )

    return {
        "claim_id": claim_id,
        "deal_id": deal_id,
        "expires_at": claim_expires.isoformat(),
        "message": "Deal claimed. Use it within 24 hours when purchasing tickets.",
    }


@flash_deals_router.get("/my-claims")
async def get_my_flash_deal_claims(user = Depends(get_current_user)):
    """Get the current user's active (un-redeemed, un-expired) flash deal claims."""
    claims = await db.flash_deal_claims.find(
        {"user_id": user["user_id"], "redeemed": False},
        {"_id": 0}
    ).to_list(100)

    now = datetime.now(timezone.utc)
    active = []
    for claim in claims:
        expires_at = claim.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now:
            active.append(claim)

    return active


# ============= SEED DATA =============

@api_router.post("/seed")
async def seed_data():
    """Seed database with sample data"""
    
    # Check if already seeded
    existing_events = await db.events.count_documents({})
    if existing_events > 0:
        return {"message": "Data already seeded"}
    
    # Sample events
    sample_events = [
        {
            "event_id": "event_demo_001",
            "title": "Summer Jazz Festival",
            "description": "Experience the best of jazz with live performances from top artists. Food vendors, craft beer, and amazing music await!",
            "category": "concert",
            "start_date": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=3, hours=6)).isoformat(),
            "location_name": "Central Park Amphitheater",
            "address": "123 Park Ave",
            "city": "New York",
            "state": "NY",
            "zip_code": "10001",
            "latitude": 40.7829,
            "longitude": -73.9654,
            "image_url": "https://images.unsplash.com/photo-1765278797923-10a027f5c69d?w=800",
            "is_paid": True,
            "ticket_price": 45.00,
            "discount_percentage": 15,
            "discounted_price": 38.25,
            "total_tickets": 500,
            "tickets_sold": 234,
            "is_promoted": True,
            "promotion_expires": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
            "tags": ["jazz", "music", "festival", "outdoor"],
            "organizer_id": "system",
            "organizer_name": "NYC Events Co",
            "organizer_type": "business",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "event_id": "event_demo_002",
            "title": "Downtown Farmers Market",
            "description": "Fresh local produce, artisan goods, and homemade treats. Support local farmers every Saturday!",
            "category": "market",
            "start_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=2, hours=4)).isoformat(),
            "location_name": "City Square",
            "address": "456 Main St",
            "city": "Brooklyn",
            "state": "NY",
            "zip_code": "11201",
            "latitude": 40.6892,
            "longitude": -73.9857,
            "image_url": "https://images.unsplash.com/photo-1666480141485-d1a86796ca85?w=800",
            "is_paid": False,
            "ticket_price": None,
            "discount_percentage": None,
            "discounted_price": None,
            "total_tickets": None,
            "tickets_sold": 0,
            "is_promoted": False,
            "promotion_expires": None,
            "tags": ["farmers market", "organic", "local", "food"],
            "organizer_id": "system",
            "organizer_name": "Brooklyn Markets",
            "organizer_type": "business",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "event_id": "event_demo_003",
            "title": "5K Charity Run",
            "description": "Join us for a fun 5K run to support local children's hospital. All fitness levels welcome!",
            "category": "marathon",
            "start_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=7, hours=3)).isoformat(),
            "location_name": "Riverside Park",
            "address": "789 River Road",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10024",
            "latitude": 40.7903,
            "longitude": -73.9745,
            "image_url": "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800",
            "is_paid": True,
            "ticket_price": 25.00,
            "discount_percentage": None,
            "discounted_price": None,
            "total_tickets": 300,
            "tickets_sold": 156,
            "is_promoted": True,
            "promotion_expires": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
            "tags": ["running", "charity", "fitness", "5k"],
            "organizer_id": "system",
            "organizer_name": "Run for Good",
            "organizer_type": "business",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "event_id": "event_demo_004",
            "title": "Multi-Family Garage Sale",
            "description": "Huge neighborhood garage sale! Furniture, clothes, electronics, toys, and more at amazing prices.",
            "category": "garage_sale",
            "start_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=1, hours=6)).isoformat(),
            "location_name": "Oak Street Community",
            "address": "321 Oak St",
            "city": "Queens",
            "state": "NY",
            "zip_code": "11375",
            "latitude": 40.7282,
            "longitude": -73.8317,
            "image_url": "https://images.unsplash.com/photo-1768321611388-51d2ad51ceed?w=800",
            "is_paid": False,
            "ticket_price": None,
            "discount_percentage": None,
            "discounted_price": None,
            "total_tickets": None,
            "tickets_sold": 0,
            "is_promoted": False,
            "promotion_expires": None,
            "tags": ["garage sale", "bargains", "second hand", "community"],
            "organizer_id": "system",
            "organizer_name": "Sarah Miller",
            "organizer_type": "personal",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "event_id": "event_demo_005",
            "title": "Happy Hour at The Blue Note",
            "description": "2-for-1 cocktails and live acoustic music. Perfect way to end your work week!",
            "category": "happy_hour",
            "start_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=1, hours=3)).isoformat(),
            "location_name": "The Blue Note Bar",
            "address": "555 Jazz Alley",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10012",
            "latitude": 40.7308,
            "longitude": -73.9973,
            "image_url": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800",
            "is_paid": False,
            "ticket_price": None,
            "discount_percentage": None,
            "discounted_price": None,
            "total_tickets": None,
            "tickets_sold": 0,
            "is_promoted": True,
            "promotion_expires": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "tags": ["happy hour", "cocktails", "music", "bar"],
            "organizer_id": "system",
            "organizer_name": "The Blue Note",
            "organizer_type": "business",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "event_id": "event_demo_006",
            "title": "Street Food Festival",
            "description": "Over 30 food trucks and vendors serving cuisines from around the world. Live music and family fun!",
            "category": "food_festival",
            "start_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=5, hours=8)).isoformat(),
            "location_name": "Pier 17",
            "address": "89 South Street",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10038",
            "latitude": 40.7063,
            "longitude": -74.0034,
            "image_url": "https://images.unsplash.com/photo-1620589125156-fd5028c5e05b?w=800",
            "is_paid": True,
            "ticket_price": 15.00,
            "discount_percentage": 20,
            "discounted_price": 12.00,
            "total_tickets": 1000,
            "tickets_sold": 420,
            "is_promoted": True,
            "promotion_expires": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat(),
            "tags": ["food", "festival", "international", "family"],
            "organizer_id": "system",
            "organizer_name": "NYC Food Events",
            "organizer_type": "business",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Sample food trucks
    sample_trucks = [
        {
            "truck_id": "truck_demo_001",
            "name": "Taco Loco",
            "description": "Authentic Mexican street tacos and burritos. Family recipes passed down for generations.",
            "cuisine_type": "Mexican",
            "latitude": 40.7580,
            "longitude": -73.9855,
            "address": "Times Square Area",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10036",
            "operating_hours": "11AM - 9PM",
            "image_url": "https://images.unsplash.com/photo-1620589125156-fd5028c5e05b?w=800",
            "menu_highlights": ["Carne Asada Tacos", "Al Pastor Burrito", "Churros"],
            "owner_id": "system",
            "owner_name": "Maria's Kitchen",
            "rating": 4.7,
            "review_count": 89,
            "is_active_today": True,
            "last_updated": datetime.now(timezone.utc).isoformat()
        },
        {
            "truck_id": "truck_demo_002",
            "name": "Seoul Food",
            "description": "Korean BBQ and fusion dishes. Try our famous Korean fried chicken!",
            "cuisine_type": "Korean",
            "latitude": 40.7484,
            "longitude": -73.9857,
            "address": "Herald Square",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10001",
            "operating_hours": "11AM - 8PM",
            "image_url": "https://images.unsplash.com/photo-1567129937968-cdad8f07e2f8?w=800",
            "menu_highlights": ["Korean Fried Chicken", "Bulgogi Bowl", "Kimchi Fries"],
            "owner_id": "system",
            "owner_name": "Seoul Food Inc",
            "rating": 4.5,
            "review_count": 67,
            "is_active_today": True,
            "last_updated": datetime.now(timezone.utc).isoformat()
        },
        {
            "truck_id": "truck_demo_003",
            "name": "Pizza Wheels",
            "description": "Wood-fired Neapolitan pizza made fresh on the spot. Authentic Italian flavors!",
            "cuisine_type": "Italian",
            "latitude": 40.7614,
            "longitude": -73.9776,
            "address": "Columbus Circle",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10019",
            "operating_hours": "12PM - 10PM",
            "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800",
            "menu_highlights": ["Margherita Pizza", "Quattro Formaggi", "Tiramisu"],
            "owner_id": "system",
            "owner_name": "Pizza Wheels LLC",
            "rating": 4.8,
            "review_count": 124,
            "is_active_today": True,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.events.insert_many(sample_events)
    await db.food_trucks.insert_many(sample_trucks)
    
    # Sample Restaurants
    sample_restaurants = [
        {
            "restaurant_id": "rest_demo_001",
            "name": "The Italian Corner",
            "description": "Authentic Italian cuisine with fresh pasta made daily. Family-owned since 1985.",
            "cuisine_type": "Italian",
            "price_level": 3,
            "address": "234 Little Italy Lane",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10013",
            "latitude": 40.7195,
            "longitude": -73.9973,
            "phone": "(212) 555-0123",
            "website": "https://italiancorner.com",
            "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
            "hours": {
                "monday": {"open": "11:30", "close": "22:00"},
                "tuesday": {"open": "11:30", "close": "22:00"},
                "wednesday": {"open": "11:30", "close": "22:00"},
                "thursday": {"open": "11:30", "close": "23:00"},
                "friday": {"open": "11:30", "close": "23:00"},
                "saturday": {"open": "12:00", "close": "23:00"},
                "sunday": {"open": "12:00", "close": "21:00"}
            },
            "features": ["outdoor_seating", "reservations", "takeout", "wine_bar"],
            "mood_tags": ["romantic", "date_night", "special_occasion"],
            "rating": 4.6,
            "review_count": 234,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "restaurant_id": "rest_demo_002",
            "name": "Sakura Sushi House",
            "description": "Premium omakase and fresh sushi. Traditional Japanese dining experience.",
            "cuisine_type": "Japanese",
            "price_level": 4,
            "address": "567 East Village Ave",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10003",
            "latitude": 40.7264,
            "longitude": -73.9878,
            "phone": "(212) 555-0456",
            "image_url": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
            "hours": {
                "monday": {"closed": True},
                "tuesday": {"open": "17:00", "close": "22:00"},
                "wednesday": {"open": "17:00", "close": "22:00"},
                "thursday": {"open": "17:00", "close": "22:00"},
                "friday": {"open": "17:00", "close": "23:00"},
                "saturday": {"open": "12:00", "close": "23:00"},
                "sunday": {"open": "12:00", "close": "21:00"}
            },
            "features": ["reservations", "bar", "private_dining"],
            "mood_tags": ["upscale", "date_night", "business_dinner"],
            "rating": 4.8,
            "review_count": 156,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "restaurant_id": "rest_demo_003",
            "name": "BBQ Pit Masters",
            "description": "Texas-style BBQ with slow-smoked brisket, ribs, and all the fixings. Family-friendly with outdoor patio.",
            "cuisine_type": "BBQ",
            "price_level": 2,
            "address": "890 Smokehouse Road",
            "city": "Brooklyn",
            "state": "NY",
            "zip_code": "11215",
            "latitude": 40.6681,
            "longitude": -73.9806,
            "phone": "(718) 555-0789",
            "image_url": "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800",
            "hours": {
                "monday": {"open": "11:00", "close": "21:00"},
                "tuesday": {"open": "11:00", "close": "21:00"},
                "wednesday": {"open": "11:00", "close": "21:00"},
                "thursday": {"open": "11:00", "close": "21:00"},
                "friday": {"open": "11:00", "close": "22:00"},
                "saturday": {"open": "11:00", "close": "22:00"},
                "sunday": {"open": "11:00", "close": "20:00"}
            },
            "features": ["outdoor_seating", "takeout", "catering", "kid_friendly"],
            "mood_tags": ["family_friendly", "casual", "groups"],
            "rating": 4.5,
            "review_count": 312,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "restaurant_id": "rest_demo_004",
            "name": "Vegan Paradise",
            "description": "Plant-based cuisine that even meat-lovers will enjoy. Organic, locally-sourced ingredients.",
            "cuisine_type": "Vegan",
            "price_level": 2,
            "address": "123 Green Street",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10014",
            "latitude": 40.7352,
            "longitude": -74.0056,
            "phone": "(212) 555-0999",
            "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
            "hours": {
                "monday": {"open": "09:00", "close": "21:00"},
                "tuesday": {"open": "09:00", "close": "21:00"},
                "wednesday": {"open": "09:00", "close": "21:00"},
                "thursday": {"open": "09:00", "close": "21:00"},
                "friday": {"open": "09:00", "close": "22:00"},
                "saturday": {"open": "10:00", "close": "22:00"},
                "sunday": {"open": "10:00", "close": "20:00"}
            },
            "features": ["outdoor_seating", "delivery", "takeout", "brunch"],
            "mood_tags": ["healthy", "vegetarian", "dog_friendly"],
            "rating": 4.4,
            "review_count": 189,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "restaurant_id": "rest_demo_005",
            "name": "El Mariachi Cantina",
            "description": "Authentic Mexican with handmade tortillas, fresh guacamole, and 50+ tequilas.",
            "cuisine_type": "Mexican",
            "price_level": 2,
            "address": "456 Cinco de Mayo Blvd",
            "city": "Queens",
            "state": "NY",
            "zip_code": "11372",
            "latitude": 40.7515,
            "longitude": -73.8836,
            "phone": "(718) 555-1234",
            "image_url": "https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?w=800",
            "hours": {
                "monday": {"open": "11:00", "close": "22:00"},
                "tuesday": {"open": "11:00", "close": "22:00"},
                "wednesday": {"open": "11:00", "close": "22:00"},
                "thursday": {"open": "11:00", "close": "23:00"},
                "friday": {"open": "11:00", "close": "24:00"},
                "saturday": {"open": "10:00", "close": "24:00"},
                "sunday": {"open": "10:00", "close": "22:00"}
            },
            "features": ["outdoor_seating", "bar", "live_music", "happy_hour"],
            "mood_tags": ["family_friendly", "groups", "lively"],
            "rating": 4.3,
            "review_count": 267,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Sample Attractions (Parks, Trails, Sites)
    sample_attractions = [
        {
            "attraction_id": "attr_demo_001",
            "name": "Central Park",
            "description": "843-acre urban oasis with walking paths, lakes, gardens, and iconic landmarks. Perfect for picnics, jogging, or simply enjoying nature in the city.",
            "attraction_type": "park",
            "address": "Central Park",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10024",
            "latitude": 40.7829,
            "longitude": -73.9654,
            "image_url": "https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=800",
            "hours": {"monday": {"open": "06:00", "close": "01:00"}, "tuesday": {"open": "06:00", "close": "01:00"}, "wednesday": {"open": "06:00", "close": "01:00"}, "thursday": {"open": "06:00", "close": "01:00"}, "friday": {"open": "06:00", "close": "01:00"}, "saturday": {"open": "06:00", "close": "01:00"}, "sunday": {"open": "06:00", "close": "01:00"}},
            "admission_fee": None,
            "is_free": True,
            "amenities": ["restrooms", "parking", "picnic_area", "water_fountain", "playground", "bike_rental"],
            "mood_tags": ["family_friendly", "dog_friendly", "wheelchair_accessible", "scenic", "romantic"],
            "best_time_to_visit": "Early morning or late afternoon for fewer crowds",
            "tips": "Visit Bethesda Fountain and row a boat on The Lake. Great for sunset views from Belvedere Castle.",
            "rating": 4.9,
            "review_count": 5420,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "attraction_id": "attr_demo_002",
            "name": "Hudson River Greenway Trail",
            "description": "11-mile paved trail along the Hudson River with stunning views of the water and New Jersey skyline. Great for biking, jogging, and rollerblading.",
            "attraction_type": "hiking_trail",
            "address": "Hudson River Park",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10014",
            "latitude": 40.7371,
            "longitude": -74.0105,
            "image_url": "https://images.unsplash.com/photo-1601024445121-e5b82f020549?w=800",
            "hours": None,
            "admission_fee": None,
            "is_free": True,
            "difficulty_level": "easy",
            "trail_length": 11.0,
            "estimated_duration": "2-4 hours",
            "amenities": ["restrooms", "water_fountain", "bike_rental", "benches"],
            "mood_tags": ["dog_friendly", "wheelchair_accessible", "scenic", "fitness"],
            "best_time_to_visit": "Sunset for beautiful views",
            "tips": "Start at Battery Park and head north. Stop at Little Island for a break.",
            "rating": 4.7,
            "review_count": 1823,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "attraction_id": "attr_demo_003",
            "name": "Prospect Park",
            "description": "585-acre Brooklyn park designed by the creators of Central Park. Features meadows, woodlands, a lake, and the Prospect Park Zoo.",
            "attraction_type": "park",
            "address": "95 Prospect Park West",
            "city": "Brooklyn",
            "state": "NY",
            "zip_code": "11215",
            "latitude": 40.6602,
            "longitude": -73.9690,
            "image_url": "https://images.unsplash.com/photo-1595880500386-4b33c7eb4509?w=800",
            "hours": {"monday": {"open": "05:00", "close": "01:00"}, "tuesday": {"open": "05:00", "close": "01:00"}, "wednesday": {"open": "05:00", "close": "01:00"}, "thursday": {"open": "05:00", "close": "01:00"}, "friday": {"open": "05:00", "close": "01:00"}, "saturday": {"open": "05:00", "close": "01:00"}, "sunday": {"open": "05:00", "close": "01:00"}},
            "admission_fee": None,
            "is_free": True,
            "amenities": ["restrooms", "parking", "picnic_area", "playground", "zoo", "ice_rink"],
            "mood_tags": ["family_friendly", "dog_friendly", "scenic"],
            "best_time_to_visit": "Spring for cherry blossoms, Fall for foliage",
            "tips": "Visit the Boathouse for paddleboat rentals. Check out Smorgasburg food market on Sundays.",
            "rating": 4.8,
            "review_count": 2156,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "attraction_id": "attr_demo_004",
            "name": "The High Line",
            "description": "Elevated linear park built on historic freight rail lines. Features gardens, art installations, and unique city views.",
            "attraction_type": "park",
            "address": "820 Washington St",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10014",
            "latitude": 40.7480,
            "longitude": -74.0048,
            "image_url": "https://images.unsplash.com/photo-1573155993874-d5d48af862ba?w=800",
            "hours": {"monday": {"open": "07:00", "close": "22:00"}, "tuesday": {"open": "07:00", "close": "22:00"}, "wednesday": {"open": "07:00", "close": "22:00"}, "thursday": {"open": "07:00", "close": "22:00"}, "friday": {"open": "07:00", "close": "22:00"}, "saturday": {"open": "07:00", "close": "22:00"}, "sunday": {"open": "07:00", "close": "22:00"}},
            "admission_fee": None,
            "is_free": True,
            "trail_length": 1.45,
            "estimated_duration": "1-2 hours",
            "amenities": ["restrooms", "water_fountain", "food_vendors"],
            "mood_tags": ["wheelchair_accessible", "scenic", "romantic", "photography"],
            "best_time_to_visit": "Weekday mornings to avoid crowds",
            "tips": "Walk from Gansevoort Street to Hudson Yards for the full experience. Check out the viewing window over 10th Avenue.",
            "rating": 4.6,
            "review_count": 3421,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "attraction_id": "attr_demo_005",
            "name": "Staten Island Greenbelt",
            "description": "2,800 acres of protected parkland with 35+ miles of trails. Home to diverse ecosystems, wildlife, and historic sites.",
            "attraction_type": "nature_reserve",
            "address": "700 Rockland Ave",
            "city": "Staten Island",
            "state": "NY",
            "zip_code": "10314",
            "latitude": 40.5795,
            "longitude": -74.1502,
            "image_url": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
            "hours": None,
            "admission_fee": None,
            "is_free": True,
            "difficulty_level": "moderate",
            "trail_length": 35.0,
            "estimated_duration": "2-6 hours depending on trail",
            "amenities": ["restrooms", "parking", "nature_center", "camping"],
            "mood_tags": ["nature_lovers", "hiking", "birdwatching", "dog_friendly"],
            "best_time_to_visit": "Spring and Fall for best hiking weather",
            "tips": "Start at the Nature Center for maps. The Blue Trail offers the most scenic views.",
            "rating": 4.5,
            "review_count": 567,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "attraction_id": "attr_demo_006",
            "name": "Brooklyn Bridge",
            "description": "Iconic 1883 suspension bridge connecting Manhattan and Brooklyn. Walk the pedestrian path for stunning city views.",
            "attraction_type": "landmark",
            "address": "Brooklyn Bridge",
            "city": "Manhattan",
            "state": "NY",
            "zip_code": "10038",
            "latitude": 40.7061,
            "longitude": -73.9969,
            "image_url": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800",
            "hours": None,
            "admission_fee": None,
            "is_free": True,
            "trail_length": 1.1,
            "estimated_duration": "30-60 minutes",
            "amenities": ["none"],
            "mood_tags": ["scenic", "romantic", "photography", "historic"],
            "best_time_to_visit": "Sunrise or sunset for best photos",
            "tips": "Walk from Brooklyn to Manhattan for the best views. Visit DUMBO area in Brooklyn before/after.",
            "rating": 4.8,
            "review_count": 8932,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Sample Forum Posts
    sample_posts = [
        {
            "post_id": "post_demo_001",
            "title": "Best coffee shops for remote work?",
            "content": "Looking for coffee shops with good wifi and plenty of outlets. Somewhere I can work for a few hours without feeling rushed. Any recommendations in Manhattan or Brooklyn?",
            "category": "questions",
            "tags": ["coffee", "remote work", "wifi"],
            "location_specific": False,
            "author_id": "system",
            "author_name": "Local Explorer",
            "upvotes": 24,
            "downvotes": 1,
            "comment_count": 12,
            "is_pinned": False,
            "is_moderated": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
        },
        {
            "post_id": "post_demo_002",
            "title": "Streetwear swap this Saturday!",
            "content": "Organizing a streetwear swap at McCarren Park this Saturday at 2pm. Bring your vintage pieces, sneakers, or anything fashion-related you want to trade. All styles welcome!",
            "category": "meetups",
            "tags": ["fashion", "swap", "meetup"],
            "location_specific": True,
            "latitude": 40.7200,
            "longitude": -73.9500,
            "neighborhood": "Williamsburg",
            "author_id": "system",
            "author_name": "Fashion Forward",
            "upvotes": 45,
            "downvotes": 2,
            "comment_count": 23,
            "is_pinned": True,
            "is_moderated": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        },
        {
            "post_id": "post_demo_003",
            "title": "Road closure on Broadway this weekend",
            "content": "Heads up everyone - Broadway will be closed between 42nd and 50th streets this weekend for a street fair. Plan alternate routes if you need to get through Times Square area.",
            "category": "alerts",
            "tags": ["traffic", "road closure", "times square"],
            "location_specific": True,
            "latitude": 40.7580,
            "longitude": -73.9855,
            "neighborhood": "Times Square",
            "author_id": "system",
            "author_name": "NYC Traffic Watch",
            "upvotes": 89,
            "downvotes": 0,
            "comment_count": 7,
            "is_pinned": True,
            "is_moderated": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        },
        {
            "post_id": "post_demo_004",
            "title": "Free piano on Myrtle Ave - come get it!",
            "content": "We're moving and can't take our upright piano. It's in decent condition, just needs tuning. Located on Myrtle Ave near Fort Greene Park. You must pick up - we cannot deliver. Available until Sunday.",
            "category": "for_sale",
            "tags": ["free", "piano", "furniture"],
            "location_specific": True,
            "latitude": 40.6920,
            "longitude": -73.9745,
            "neighborhood": "Fort Greene",
            "author_id": "system",
            "author_name": "Moving Soon",
            "upvotes": 15,
            "downvotes": 0,
            "comment_count": 8,
            "is_pinned": False,
            "is_moderated": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=8)).isoformat()
        },
        {
            "post_id": "post_demo_005",
            "title": "New Vietnamese restaurant on Smith St - Highly recommend!",
            "content": "Just tried the new pho place that opened on Smith St and it's amazing! Best pho I've had outside of Vietnam. The banh mi is also excellent. Very reasonable prices and the staff is super friendly.",
            "category": "recommendations",
            "tags": ["restaurant", "vietnamese", "food"],
            "location_specific": True,
            "latitude": 40.6850,
            "longitude": -73.9890,
            "neighborhood": "Carroll Gardens",
            "author_id": "system",
            "author_name": "Foodie Fan",
            "upvotes": 67,
            "downvotes": 3,
            "comment_count": 19,
            "is_pinned": False,
            "is_moderated": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        }
    ]
    
    # Add mood_tags to existing events
    for event in sample_events:
        if event["category"] in ["concert", "happy_hour"]:
            event["mood_tags"] = ["adults_only", "lively"]
        elif event["category"] in ["market", "garage_sale", "food_festival"]:
            event["mood_tags"] = ["family_friendly", "dog_friendly", "outdoor"]
        elif event["category"] == "marathon":
            event["mood_tags"] = ["fitness", "outdoor", "family_friendly"]
        else:
            event["mood_tags"] = ["family_friendly"]
    
    # Insert all data
    await db.restaurants.insert_many(sample_restaurants)
    await db.attractions.insert_many(sample_attractions)
    await db.forum_posts.insert_many(sample_posts)
    
    return {
        "message": "Sample data seeded successfully", 
        "events": len(sample_events), 
        "food_trucks": len(sample_trucks),
        "restaurants": len(sample_restaurants),
        "attractions": len(sample_attractions),
        "forum_posts": len(sample_posts)
    }

# ============= MAIN ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "LocalVibe API v1.0", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}


# ============= LOCAL NEWS =============

@api_router.get("/news")
async def get_news(limit: int = 20):
    """Recent local-area news headlines (Google News RSS, refreshed daily)."""
    cursor = db.news.find({}, {"_id": 0}).sort("published_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return items


# ============= ADMIN: INGESTION TRIGGER =============
# Gate with a simple shared secret in the X-Admin-Token header. Set ADMIN_TOKEN
# in Render env vars. Useful for manually triggering an ingestion run during
# the pilot before the daily cron has fired, or after fixing data.

def _check_admin(request: Request, token_query: Optional[str]):
    """Validate the admin token from header OR ?token= query param.
    Query param support makes it easy to test from the Swagger /docs UI."""
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="ADMIN_TOKEN not configured")
    provided = request.headers.get("X-Admin-Token") or token_query
    if provided != expected:
        raise HTTPException(status_code=401, detail="Invalid admin token")


@api_router.post("/admin/ingest")
async def admin_trigger_ingest(request: Request, token: Optional[str] = None):
    """Trigger an ingestion run. Pass token via ?token=... or X-Admin-Token header."""
    _check_admin(request, token)
    from ingestion.runner import run_all
    summary = await run_all()
    return summary


@api_router.get("/admin/ingestion-runs")
async def admin_get_ingestion_runs(request: Request, token: Optional[str] = None, limit: int = 20):
    """Recent ingestion run history for monitoring."""
    _check_admin(request, token)
    runs = await db.ingestion_runs.find({}, {"_id": 0}).sort("started_at", -1).to_list(limit)
    return runs


@api_router.get("/admin/test-yelp-chains")
async def admin_test_yelp_chains(request: Request, token: Optional[str] = None):
    """Debug: run the explicit chain searches and return per-term diagnostics
    (HTTP status, raw business names returned, names that survived our match
    filter). Tells us exactly where chain detection is breaking."""
    _check_admin(request, token)
    from ingestion import yelp
    return await yelp.debug_chain_searches()


@api_router.get("/admin/test-yelp-full")
async def admin_test_yelp_full(request: Request, token: Optional[str] = None):
    """Debug: run the full Yelp restaurant fetch (all 3 passes) and report
    how many businesses came from each pass, the deduped total, and how
    many got tagged as chains/markets/food_trucks. Confirms whether the
    chain pass is actually reaching the unified candidate list."""
    _check_admin(request, token)
    from ingestion import yelp
    return await yelp.debug_full_fetch()


@api_router.get("/admin/test-osm")
async def admin_test_osm(request: Request, token: Optional[str] = None):
    """Debug: run only the OSM Overpass fetch and return rich diagnostics
    (HTTP status, byte count, raw element count, normalization stats,
    plus a sample of records). Does not touch the database."""
    _check_admin(request, token)
    from ingestion import osm_attractions
    return await osm_attractions.fetch_attractions_with_debug()


@api_router.get("/admin/data-counts")
async def admin_data_counts(request: Request, token: Optional[str] = None):
    """Quick diagnostic: counts per collection, broken down by source.
    Useful to confirm OSM/Yelp/Ticketmaster ingestion actually wrote records."""
    _check_admin(request, token)
    collections = ["events", "restaurants", "food_trucks", "attractions", "ingestion_runs"]
    out: Dict[str, Any] = {}
    for col in collections:
        total = await db[col].count_documents({})
        by_source: Dict[str, int] = {}
        async for r in db[col].aggregate([
            {"$group": {"_id": "$_source", "count": {"$sum": 1}}}
        ]):
            label = r["_id"] or "user_submitted"
            by_source[label] = r["count"]
        out[col] = {"total": total, "by_source": by_source}

    # Chain breakdown for restaurants — sanity-check the chain ingestion
    chain_count = await db.restaurants.count_documents({"is_chain": True})
    independent_count = await db.restaurants.count_documents(
        {"$or": [{"is_chain": False}, {"is_chain": {"$exists": False}}]}
    )
    out["restaurants"]["chains"] = chain_count
    out["restaurants"]["independents"] = independent_count

    # Sample chain names so we can see WHAT got tagged as chains
    chain_sample = await db.restaurants.find(
        {"is_chain": True}, {"_id": 0, "name": 1}
    ).limit(30).to_list(30)
    out["restaurants"]["chain_sample"] = [r["name"] for r in chain_sample]

    return out


@api_router.post("/admin/wipe-seed-community")
async def admin_wipe_seed_community(request: Request, token: Optional[str] = None):
    """Delete the NYC mockup forum posts that were inserted by /api/seed.
    Identified by post_id starting with 'post_demo_' OR author_id 'system'.
    Real user-submitted posts (real account ids) are preserved."""
    _check_admin(request, token)
    result = await db.forum_posts.delete_many({
        "$or": [
            {"post_id": {"$regex": "^post_demo_"}},
            {"author_id": "system"},
        ]
    })
    return {"deleted": result.deleted_count}


@api_router.post("/admin/reset-external")
async def admin_reset_external(request: Request, token: Optional[str] = None):
    """Wipe all externally-ingested records (events, restaurants, attractions)
    so a fresh ingestion run will re-import them with the latest schema.
    User-submitted records (no `_source` field) are NOT touched."""
    _check_admin(request, token)
    events_result = await db.events.delete_many({"_source": {"$exists": True}})
    restaurants_result = await db.restaurants.delete_many({"_source": {"$exists": True}})
    attractions_result = await db.attractions.delete_many({"_source": {"$exists": True}})
    food_trucks_result = await db.food_trucks.delete_many({"_source": {"$exists": True}})
    return {
        "events_deleted": events_result.deleted_count,
        "restaurants_deleted": restaurants_result.deleted_count,
        "attractions_deleted": attractions_result.deleted_count,
        "food_trucks_deleted": food_trucks_result.deleted_count,
    }


# Include all routers
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(events_router)
app.include_router(foodtrucks_router)
app.include_router(payments_router)
app.include_router(ai_router)
app.include_router(flash_deals_router)

# Import and setup new feature routers
from routes import restaurants, attractions, community, gamification, subscriptions

restaurants_router = restaurants.setup_routes(db, calculate_distance, get_current_user, get_optional_user)
attractions_router = attractions.setup_routes(db, calculate_distance, get_current_user, get_optional_user)
community_router = community.setup_routes(db, calculate_distance, get_current_user, get_optional_user)
gamification_router = gamification.setup_routes(db, calculate_distance, get_current_user, get_optional_user)
subscriptions_router = subscriptions.setup_routes(db, calculate_distance, get_current_user, get_optional_user)

app.include_router(restaurants_router)
app.include_router(attractions_router)
app.include_router(community_router)
app.include_router(gamification_router)
app.include_router(subscriptions_router)

# CORS: read allowed origins from env (comma-separated). Use "*" only in dev.
# Note: `allow_credentials=True` with `allow_origins=["*"]` is invalid per CORS spec,
# so we disable credentials when wildcard is used.
_cors_raw = os.environ.get("CORS_ORIGINS", "*").strip()
if _cors_raw == "*":
    _cors_origins: List[str] = ["*"]
    _cors_credentials = False
else:
    _cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    _cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_credentials=_cors_credentials,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
