from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/gamification")

# Gamification Models
class Badge(BaseModel):
    badge_id: str
    name: str
    description: str
    icon: str
    points_required: int
    category: str  # explorer, contributor, organizer, social, expert

class UserPoints(BaseModel):
    user_id: str
    total_points: int
    events_attended: int
    events_created: int
    reviews_posted: int
    forum_posts: int
    forum_comments: int
    badges: List[str] = []
    level: int
    level_name: str

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    total_points: int
    level: int
    badge_count: int

# Badge Definitions
BADGES = [
    # Explorer Badges
    {"badge_id": "first_event", "name": "First Timer", "description": "Attended your first event", "icon": "Star", "points_required": 0, "category": "explorer", "action": "attend_event", "count": 1},
    {"badge_id": "event_hopper", "name": "Event Hopper", "description": "Attended 5 events", "icon": "Zap", "points_required": 0, "category": "explorer", "action": "attend_event", "count": 5},
    {"badge_id": "local_expert", "name": "Local Expert", "description": "Attended 25 events", "icon": "Award", "points_required": 0, "category": "explorer", "action": "attend_event", "count": 25},
    {"badge_id": "city_guide", "name": "City Guide", "description": "Attended 100 events", "icon": "Map", "points_required": 0, "category": "explorer", "action": "attend_event", "count": 100},
    
    # Contributor Badges
    {"badge_id": "first_review", "name": "Critic", "description": "Posted your first review", "icon": "MessageCircle", "points_required": 0, "category": "contributor", "action": "post_review", "count": 1},
    {"badge_id": "reviewer", "name": "Trusted Reviewer", "description": "Posted 10 reviews", "icon": "CheckCircle", "points_required": 0, "category": "contributor", "action": "post_review", "count": 10},
    {"badge_id": "top_reviewer", "name": "Top Reviewer", "description": "Posted 50 reviews", "icon": "Trophy", "points_required": 0, "category": "contributor", "action": "post_review", "count": 50},
    
    # Organizer Badges
    {"badge_id": "first_event_created", "name": "Event Creator", "description": "Created your first event", "icon": "Plus", "points_required": 0, "category": "organizer", "action": "create_event", "count": 1},
    {"badge_id": "community_organizer", "name": "Community Organizer", "description": "Created 5 events", "icon": "Users", "points_required": 0, "category": "organizer", "action": "create_event", "count": 5},
    {"badge_id": "event_master", "name": "Event Master", "description": "Created 25 events", "icon": "Crown", "points_required": 0, "category": "organizer", "action": "create_event", "count": 25},
    
    # Social Badges
    {"badge_id": "first_post", "name": "Community Voice", "description": "Made your first forum post", "icon": "MessageSquare", "points_required": 0, "category": "social", "action": "forum_post", "count": 1},
    {"badge_id": "active_member", "name": "Active Member", "description": "Made 20 forum posts", "icon": "TrendingUp", "points_required": 0, "category": "social", "action": "forum_post", "count": 20},
    {"badge_id": "helpful", "name": "Helpful Neighbor", "description": "Received 50 upvotes on posts", "icon": "Heart", "points_required": 0, "category": "social", "action": "receive_upvotes", "count": 50},
    
    # Point-based Badges
    {"badge_id": "rising_star", "name": "Rising Star", "description": "Earned 100 points", "icon": "Sparkles", "points_required": 100, "category": "expert", "action": "points", "count": 100},
    {"badge_id": "local_hero", "name": "Local Hero", "description": "Earned 500 points", "icon": "Shield", "points_required": 500, "category": "expert", "action": "points", "count": 500},
    {"badge_id": "community_champion", "name": "Community Champion", "description": "Earned 1000 points", "icon": "Medal", "points_required": 1000, "category": "expert", "action": "points", "count": 1000},
]

# Level Definitions
LEVELS = [
    {"level": 1, "name": "Newcomer", "min_points": 0},
    {"level": 2, "name": "Explorer", "min_points": 50},
    {"level": 3, "name": "Regular", "min_points": 150},
    {"level": 4, "name": "Active Member", "min_points": 300},
    {"level": 5, "name": "Contributor", "min_points": 500},
    {"level": 6, "name": "Local Expert", "min_points": 800},
    {"level": 7, "name": "Community Star", "min_points": 1200},
    {"level": 8, "name": "Local Legend", "min_points": 2000},
    {"level": 9, "name": "City Champion", "min_points": 3500},
    {"level": 10, "name": "LocalVibe Master", "min_points": 5000},
]

# Points Configuration
POINTS_CONFIG = {
    "attend_event": 10,
    "create_event": 25,
    "post_review": 5,
    "forum_post": 5,
    "forum_comment": 2,
    "receive_upvote": 1,
    "ticket_purchase": 15,
}

def get_level(points: int) -> tuple:
    """Get user's level based on points"""
    current_level = LEVELS[0]
    for level in LEVELS:
        if points >= level["min_points"]:
            current_level = level
        else:
            break
    return current_level["level"], current_level["name"]

def setup_routes(db, calculate_distance, get_current_user, get_optional_user):
    
    @router.get("/badges")
    async def get_all_badges():
        return BADGES
    
    @router.get("/levels")
    async def get_all_levels():
        return LEVELS
    
    @router.get("/points-config")
    async def get_points_config():
        return POINTS_CONFIG
    
    @router.get("/user/{user_id}", response_model=UserPoints)
    async def get_user_points(user_id: str):
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user stats
        events_attended = await db.tickets.count_documents({"user_id": user_id, "payment_status": "paid"})
        events_created = await db.events.count_documents({"organizer_id": user_id})
        reviews_posted = await db.comments.count_documents({"user_id": user_id, "rating": {"$ne": None}})
        forum_posts = await db.forum_posts.count_documents({"author_id": user_id})
        forum_comments = await db.forum_comments.count_documents({"author_id": user_id})
        
        total_points = user.get("points", 0)
        level, level_name = get_level(total_points)
        
        # Get earned badges
        user_badges = user.get("badges", [])
        
        return UserPoints(
            user_id=user_id,
            total_points=total_points,
            events_attended=events_attended,
            events_created=events_created,
            reviews_posted=reviews_posted,
            forum_posts=forum_posts,
            forum_comments=forum_comments,
            badges=user_badges,
            level=level,
            level_name=level_name
        )
    
    @router.get("/my-stats", response_model=UserPoints)
    async def get_my_stats(user = Depends(get_current_user)):
        return await get_user_points(user["user_id"])
    
    @router.post("/check-badges")
    async def check_and_award_badges(user = Depends(get_current_user)):
        """Check and award any earned badges"""
        user_id = user["user_id"]
        
        # Get current stats
        events_attended = await db.tickets.count_documents({"user_id": user_id, "payment_status": "paid"})
        events_created = await db.events.count_documents({"organizer_id": user_id})
        reviews_posted = await db.comments.count_documents({"user_id": user_id, "rating": {"$ne": None}})
        forum_posts = await db.forum_posts.count_documents({"author_id": user_id})
        total_points = user.get("points", 0)
        
        # Get total upvotes received
        pipeline = [
            {"$match": {"author_id": user_id}},
            {"$group": {"_id": None, "total": {"$sum": "$upvotes"}}}
        ]
        upvotes_result = await db.forum_posts.aggregate(pipeline).to_list(1)
        total_upvotes = upvotes_result[0]["total"] if upvotes_result else 0
        
        current_badges = user.get("badges", [])
        new_badges = []
        
        stats = {
            "attend_event": events_attended,
            "create_event": events_created,
            "post_review": reviews_posted,
            "forum_post": forum_posts,
            "receive_upvotes": total_upvotes,
            "points": total_points,
        }
        
        for badge in BADGES:
            if badge["badge_id"] not in current_badges:
                action = badge.get("action")
                required_count = badge.get("count", 0)
                
                if action in stats and stats[action] >= required_count:
                    new_badges.append(badge["badge_id"])
        
        if new_badges:
            await db.users.update_one(
                {"user_id": user_id},
                {"$addToSet": {"badges": {"$each": new_badges}}}
            )
        
        return {
            "new_badges": new_badges,
            "total_badges": len(current_badges) + len(new_badges)
        }
    
    @router.get("/leaderboard", response_model=List[LeaderboardEntry])
    async def get_leaderboard(limit: int = Query(20)):
        users = await db.users.find(
            {"points": {"$gt": 0}},
            {"_id": 0, "user_id": 1, "name": 1, "profile_picture": 1, "points": 1, "badges": 1}
        ).sort("points", -1).limit(limit).to_list(limit)
        
        results = []
        for idx, user in enumerate(users, 1):
            level, _ = get_level(user.get("points", 0))
            results.append(LeaderboardEntry(
                rank=idx,
                user_id=user["user_id"],
                user_name=user["name"],
                user_picture=user.get("profile_picture"),
                total_points=user.get("points", 0),
                level=level,
                badge_count=len(user.get("badges", []))
            ))
        
        return results
    
    @router.post("/award-points")
    async def award_points(action: str, user = Depends(get_current_user)):
        """Award points for an action (internal use)"""
        if action not in POINTS_CONFIG:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        points = POINTS_CONFIG[action]
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"points": points}}
        )
        
        return {"points_awarded": points, "action": action}
    
    return router
