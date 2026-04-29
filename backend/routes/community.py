from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os

router = APIRouter(prefix="/api/community")

# Community Models
class ForumPostCreate(BaseModel):
    title: str
    content: str
    category: str  # general, questions, meetups, news, alerts, for_sale
    tags: List[str] = []
    location_specific: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    neighborhood: Optional[str] = None

class ForumPostResponse(BaseModel):
    post_id: str
    title: str
    content: str
    category: str
    tags: List[str] = []
    location_specific: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    neighborhood: Optional[str] = None
    author_id: str
    author_name: str
    author_picture: Optional[str] = None
    upvotes: int = 0
    downvotes: int = 0
    comment_count: int = 0
    is_pinned: bool = False
    is_moderated: bool = False
    created_at: datetime
    distance: Optional[float] = None

class ForumCommentCreate(BaseModel):
    content: str

class ForumCommentResponse(BaseModel):
    comment_id: str
    post_id: str
    content: str
    author_id: str
    author_name: str
    author_picture: Optional[str] = None
    upvotes: int = 0
    created_at: datetime

class LocalAlertCreate(BaseModel):
    title: str
    description: str
    alert_type: str  # road_closure, weather, emergency, community, event_update
    severity: str  # info, warning, urgent
    latitude: float
    longitude: float
    radius: float = 5  # miles affected
    expires_at: Optional[datetime] = None

class LocalAlertResponse(BaseModel):
    alert_id: str
    title: str
    description: str
    alert_type: str
    severity: str
    latitude: float
    longitude: float
    radius: float
    expires_at: Optional[datetime] = None
    created_by: str
    created_at: datetime
    is_active: bool = True
    distance: Optional[float] = None

FORUM_CATEGORIES = [
    {"value": "general", "label": "General Discussion", "icon": "MessageSquare"},
    {"value": "questions", "label": "Questions & Answers", "icon": "HelpCircle"},
    {"value": "meetups", "label": "Meetups & Hangouts", "icon": "Users"},
    {"value": "news", "label": "Local News", "icon": "Newspaper"},
    {"value": "alerts", "label": "Alerts & Updates", "icon": "AlertTriangle"},
    {"value": "for_sale", "label": "For Sale / Free", "icon": "Tag"},
    {"value": "recommendations", "label": "Recommendations", "icon": "ThumbsUp"},
    {"value": "lost_found", "label": "Lost & Found", "icon": "Search"},
]

def setup_routes(db, calculate_distance, get_current_user, get_optional_user):
    
    @router.get("/categories")
    async def get_forum_categories():
        return FORUM_CATEGORIES
    
    # ============= FORUM POSTS =============
    
    @router.post("/posts", response_model=ForumPostResponse)
    async def create_post(data: ForumPostCreate, user = Depends(get_current_user)):
        post_id = f"post_{uuid.uuid4().hex[:12]}"
        
        # AI moderation disabled in v1. To re-enable, integrate Google Gemini
        # directly via `google-genai`. For now, all posts are approved.
        is_appropriate = True
        
        doc = {
            "post_id": post_id,
            "title": data.title,
            "content": data.content,
            "category": data.category,
            "tags": data.tags,
            "location_specific": data.location_specific,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "neighborhood": data.neighborhood,
            "author_id": user["user_id"],
            "author_name": user["name"],
            "author_picture": user.get("profile_picture"),
            "upvotes": 0,
            "downvotes": 0,
            "comment_count": 0,
            "is_pinned": False,
            "is_moderated": not is_appropriate,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.forum_posts.insert_one(doc)
        
        # Award points for posting
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"points": 5}}
        )
        
        return ForumPostResponse(**{
            **doc,
            "created_at": datetime.now(timezone.utc)
        })
    
    @router.get("/posts", response_model=List[ForumPostResponse])
    async def get_posts(
        latitude: Optional[float] = Query(None),
        longitude: Optional[float] = Query(None),
        radius: float = Query(25),
        category: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        local_only: bool = Query(False),
        limit: int = Query(50),
        offset: int = Query(0)
    ):
        query = {"is_moderated": False}  # Only show non-flagged posts
        
        if category:
            query["category"] = category
        
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"content": {"$regex": search, "$options": "i"}},
                {"tags": {"$in": [search.lower()]}}
            ]
        
        posts = await db.forum_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        results = []
        for post in posts:
            post_copy = dict(post)
            
            if isinstance(post_copy.get("created_at"), str):
                post_copy["created_at"] = datetime.fromisoformat(post_copy["created_at"])
            
            # Filter by location if specified
            if local_only and latitude and longitude and post_copy.get("latitude"):
                distance = calculate_distance(
                    latitude, longitude,
                    post_copy["latitude"], post_copy["longitude"]
                )
                if distance <= radius:
                    post_copy["distance"] = round(distance, 1)
                    results.append(post_copy)
            else:
                if latitude and longitude and post_copy.get("latitude"):
                    post_copy["distance"] = round(calculate_distance(
                        latitude, longitude,
                        post_copy["latitude"], post_copy["longitude"]
                    ), 1)
                results.append(post_copy)
        
        # Pinned posts first, then by date
        results.sort(key=lambda x: (not x.get("is_pinned", False), -x["created_at"].timestamp()))
        
        return [ForumPostResponse(**p) for p in results[offset:offset + limit]]
    
    @router.get("/posts/{post_id}", response_model=ForumPostResponse)
    async def get_post(post_id: str):
        post = await db.forum_posts.find_one({"post_id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        if isinstance(post.get("created_at"), str):
            post["created_at"] = datetime.fromisoformat(post["created_at"])
        
        return ForumPostResponse(**post)
    
    @router.post("/posts/{post_id}/vote")
    async def vote_post(post_id: str, vote_type: str, user = Depends(get_current_user)):
        post = await db.forum_posts.find_one({"post_id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if user already voted
        existing_vote = await db.votes.find_one({
            "user_id": user["user_id"],
            "target_id": post_id,
            "target_type": "post"
        })
        
        if existing_vote:
            if existing_vote["vote_type"] == vote_type:
                # Remove vote
                await db.votes.delete_one({"_id": existing_vote["_id"]})
                inc_field = "upvotes" if vote_type == "up" else "downvotes"
                await db.forum_posts.update_one({"post_id": post_id}, {"$inc": {inc_field: -1}})
                return {"message": "Vote removed"}
            else:
                # Change vote
                await db.votes.update_one(
                    {"_id": existing_vote["_id"]},
                    {"$set": {"vote_type": vote_type}}
                )
                if vote_type == "up":
                    await db.forum_posts.update_one({"post_id": post_id}, {"$inc": {"upvotes": 1, "downvotes": -1}})
                else:
                    await db.forum_posts.update_one({"post_id": post_id}, {"$inc": {"upvotes": -1, "downvotes": 1}})
                return {"message": "Vote changed"}
        
        # New vote
        await db.votes.insert_one({
            "user_id": user["user_id"],
            "target_id": post_id,
            "target_type": "post",
            "vote_type": vote_type,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        inc_field = "upvotes" if vote_type == "up" else "downvotes"
        await db.forum_posts.update_one({"post_id": post_id}, {"$inc": {inc_field: 1}})
        
        return {"message": "Vote recorded"}
    
    @router.post("/posts/{post_id}/report")
    async def report_post(post_id: str, reason: str, user = Depends(get_current_user)):
        post = await db.forum_posts.find_one({"post_id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        await db.reports.insert_one({
            "report_id": f"report_{uuid.uuid4().hex[:12]}",
            "target_id": post_id,
            "target_type": "post",
            "reporter_id": user["user_id"],
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Auto-moderate if 3+ reports
        report_count = await db.reports.count_documents({"target_id": post_id})
        if report_count >= 3:
            await db.forum_posts.update_one({"post_id": post_id}, {"$set": {"is_moderated": True}})
        
        return {"message": "Report submitted"}
    
    # ============= FORUM COMMENTS =============
    
    @router.post("/posts/{post_id}/comments", response_model=ForumCommentResponse)
    async def create_comment(post_id: str, data: ForumCommentCreate, user = Depends(get_current_user)):
        post = await db.forum_posts.find_one({"post_id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        comment_id = f"fcmt_{uuid.uuid4().hex[:12]}"
        
        doc = {
            "comment_id": comment_id,
            "post_id": post_id,
            "content": data.content,
            "author_id": user["user_id"],
            "author_name": user["name"],
            "author_picture": user.get("profile_picture"),
            "upvotes": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.forum_comments.insert_one(doc)
        await db.forum_posts.update_one({"post_id": post_id}, {"$inc": {"comment_count": 1}})
        
        # Award points
        await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"points": 2}})
        
        return ForumCommentResponse(**{
            **doc,
            "created_at": datetime.now(timezone.utc)
        })
    
    @router.get("/posts/{post_id}/comments", response_model=List[ForumCommentResponse])
    async def get_comments(post_id: str):
        comments = await db.forum_comments.find(
            {"post_id": post_id},
            {"_id": 0}
        ).sort("created_at", 1).to_list(100)
        
        results = []
        for comment in comments:
            if isinstance(comment.get("created_at"), str):
                comment["created_at"] = datetime.fromisoformat(comment["created_at"])
            results.append(ForumCommentResponse(**comment))
        
        return results
    
    # ============= LOCAL ALERTS =============
    
    @router.post("/alerts", response_model=LocalAlertResponse)
    async def create_alert(data: LocalAlertCreate, user = Depends(get_current_user)):
        # Only verified users or business accounts can create alerts
        if user.get("account_type") != "business" and not user.get("is_verified"):
            raise HTTPException(status_code=403, detail="Only verified users can create alerts")
        
        alert_id = f"alert_{uuid.uuid4().hex[:12]}"
        
        doc = {
            "alert_id": alert_id,
            **data.dict(),
            "expires_at": data.expires_at.isoformat() if data.expires_at else None,
            "created_by": user["user_id"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.local_alerts.insert_one(doc)
        
        return LocalAlertResponse(**{
            **doc,
            "created_at": datetime.now(timezone.utc),
            "expires_at": data.expires_at
        })
    
    @router.get("/alerts", response_model=List[LocalAlertResponse])
    async def get_alerts(
        latitude: float = Query(...),
        longitude: float = Query(...),
        radius: float = Query(10)
    ):
        now = datetime.now(timezone.utc)
        
        # Get active, non-expired alerts
        alerts = await db.local_alerts.find(
            {"is_active": True},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        results = []
        for alert in alerts:
            alert_copy = dict(alert)
            
            # Check expiration
            if alert_copy.get("expires_at"):
                expires = datetime.fromisoformat(alert_copy["expires_at"])
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                if expires < now:
                    continue
                alert_copy["expires_at"] = expires
            
            if isinstance(alert_copy.get("created_at"), str):
                alert_copy["created_at"] = datetime.fromisoformat(alert_copy["created_at"])
            
            # Check if user is within alert radius
            distance = calculate_distance(
                latitude, longitude,
                alert_copy["latitude"], alert_copy["longitude"]
            )
            
            if distance <= alert_copy["radius"] + radius:
                alert_copy["distance"] = round(distance, 1)
                results.append(alert_copy)
        
        # Sort by severity then date
        severity_order = {"urgent": 0, "warning": 1, "info": 2}
        results.sort(key=lambda x: (severity_order.get(x["severity"], 3), -x["created_at"].timestamp()))
        
        return [LocalAlertResponse(**a) for a in results]
    
    return router
