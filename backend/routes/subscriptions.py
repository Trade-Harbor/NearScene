"""
Subscription and Premium Feature Routes for LocalVibe

Monetization Model:
1. Freemium: Free basic access, premium features via subscription
2. Commission on Bookings: Platform takes percentage from paid activities (5%)
3. Partnerships: Sponsored listings and promotional opportunities for businesses
"""

import os
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid


# ============= MODELS =============

class SubscriptionPlan(BaseModel):
    plan_id: str
    name: str
    tier: str  # free, basic, premium, business
    price_monthly: float
    price_yearly: float
    features: List[str]
    description: str


class UserSubscription(BaseModel):
    subscription_id: str
    user_id: str
    plan_id: str
    plan_name: str
    tier: str
    status: str  # active, cancelled, expired
    start_date: datetime
    end_date: datetime
    auto_renew: bool


class PartnershipApplication(BaseModel):
    business_name: str
    contact_email: str
    contact_phone: str
    business_type: str  # restaurant, venue, tourism_board, event_organizer, retail
    description: str
    website: Optional[str] = None
    expected_monthly_events: Optional[int] = None


class SponsoredListing(BaseModel):
    listing_id: str
    business_id: str
    business_name: str
    listing_type: str  # featured_event, top_restaurant, promoted_attraction
    target_id: str  # event_id, restaurant_id, or attraction_id
    start_date: datetime
    end_date: datetime
    impressions: int
    clicks: int
    budget: float
    spent: float
    status: str  # active, paused, completed


# Subscription Plans
SUBSCRIPTION_PLANS = [
    {
        "plan_id": "plan_free",
        "name": "Free",
        "tier": "free",
        "price_monthly": 0,
        "price_yearly": 0,
        "features": [
            "Browse all events and attractions",
            "View restaurant listings",
            "Basic search and filters",
            "Save up to 5 favorites",
            "Standard event notifications"
        ],
        "description": "Perfect for casual users exploring local events"
    },
    {
        "plan_id": "plan_basic",
        "name": "LocalVibe Plus",
        "tier": "basic",
        "price_monthly": 4.99,
        "price_yearly": 47.88,  # 20% discount
        "features": [
            "All Free features",
            "Unlimited favorites",
            "Early access to popular events",
            "Exclusive member discounts (5-15% off)",
            "Ad-free experience",
            "Priority customer support",
            "Event reminders and calendar sync"
        ],
        "description": "For active event-goers who want more perks"
    },
    {
        "plan_id": "plan_premium",
        "name": "LocalVibe Premium",
        "tier": "premium",
        "price_monthly": 9.99,
        "price_yearly": 95.88,  # 20% discount
        "features": [
            "All Plus features",
            "AI-powered personalized recommendations",
            "Exclusive VIP events access",
            "Premium discounts (up to 25% off)",
            "Free ticket upgrades when available",
            "Concierge booking assistance",
            "Monthly local experience credit ($10)",
            "Early bird ticket access (24h before public)"
        ],
        "description": "The ultimate local experience with maximum savings"
    },
    {
        "plan_id": "plan_business",
        "name": "Business Partner",
        "tier": "business",
        "price_monthly": 49.99,
        "price_yearly": 479.88,  # 20% discount
        "features": [
            "Post unlimited events",
            "Featured listing placement",
            "Analytics dashboard",
            "Reduced commission rate (3% vs 5%)",
            "Priority support",
            "Promotional tools and marketing",
            "QR code check-in system",
            "Customer insights and demographics",
            "Bulk ticket management",
            "Partnership opportunities"
        ],
        "description": "Essential tools for businesses to reach local audiences"
    }
]

# Partnership Tiers
PARTNERSHIP_TIERS = [
    {
        "tier_id": "partner_bronze",
        "name": "Bronze Partner",
        "monthly_fee": 99,
        "benefits": [
            "Logo on partner page",
            "1 sponsored listing per month",
            "Basic analytics",
            "4% commission rate"
        ]
    },
    {
        "tier_id": "partner_silver",
        "name": "Silver Partner",
        "monthly_fee": 249,
        "benefits": [
            "All Bronze benefits",
            "3 sponsored listings per month",
            "Homepage feature rotation",
            "Dedicated account manager",
            "3% commission rate"
        ]
    },
    {
        "tier_id": "partner_gold",
        "name": "Gold Partner",
        "monthly_fee": 499,
        "benefits": [
            "All Silver benefits",
            "Unlimited sponsored listings",
            "Priority placement",
            "Co-marketing opportunities",
            "Custom integrations",
            "2% commission rate"
        ]
    }
]

# Sponsored Listing Packages
SPONSORED_LISTING_PACKAGES = [
    {
        "package_id": "sponsored_basic",
        "name": "Spotlight",
        "duration_days": 7,
        "price": 29.99,
        "impressions_estimate": 5000,
        "description": "7 days of promoted visibility in search results"
    },
    {
        "package_id": "sponsored_featured",
        "name": "Featured",
        "duration_days": 14,
        "price": 59.99,
        "impressions_estimate": 15000,
        "description": "14 days featured on category pages with badge"
    },
    {
        "package_id": "sponsored_homepage",
        "name": "Homepage Hero",
        "duration_days": 7,
        "price": 149.99,
        "impressions_estimate": 50000,
        "description": "Premium homepage carousel placement"
    }
]


def setup_routes(db, calculate_distance, get_current_user, get_optional_user):
    router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions & Monetization"])

    # ============= SUBSCRIPTION ENDPOINTS =============

    @router.get("/plans")
    async def get_subscription_plans():
        """Get all available subscription plans"""
        return {
            "plans": SUBSCRIPTION_PLANS,
            "commission_rate": {
                "free": 0.05,  # 5%
                "basic": 0.05,
                "premium": 0.05,
                "business": 0.03,  # Reduced for business
                "partner_bronze": 0.04,
                "partner_silver": 0.03,
                "partner_gold": 0.02
            }
        }

    @router.get("/my-subscription")
    async def get_my_subscription(user = Depends(get_current_user)):
        """Get current user's subscription status"""
        subscription = await db.subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"},
            {"_id": 0}
        )
        
        if not subscription:
            # Return free tier info
            return {
                "tier": "free",
                "plan": SUBSCRIPTION_PLANS[0],
                "features": SUBSCRIPTION_PLANS[0]["features"],
                "subscription": None
            }
        
        # Parse dates
        if isinstance(subscription.get("start_date"), str):
            subscription["start_date"] = datetime.fromisoformat(subscription["start_date"])
        if isinstance(subscription.get("end_date"), str):
            subscription["end_date"] = datetime.fromisoformat(subscription["end_date"])
        
        plan = next((p for p in SUBSCRIPTION_PLANS if p["plan_id"] == subscription["plan_id"]), None)
        
        return {
            "tier": subscription["tier"],
            "plan": plan,
            "features": plan["features"] if plan else [],
            "subscription": subscription
        }

    @router.post("/subscribe")
    async def create_subscription(
        plan_id: str,
        billing_period: str = "monthly",  # monthly or yearly
        request = None,
        user = Depends(get_current_user)
    ):
        """Subscribe to a plan"""
        # Beta block: don't initiate Stripe checkouts during beta
        if os.environ.get("BETA_PAYMENTS_DISABLED", "true").lower() == "true":
            raise HTTPException(
                status_code=503,
                detail="Subscriptions are disabled during the NearScene beta. Email steinackerr@gmail.com if you'd like to participate in a monetization preview."
            )
        plan = next((p for p in SUBSCRIPTION_PLANS if p["plan_id"] == plan_id), None)
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        if plan["tier"] == "free":
            raise HTTPException(status_code=400, detail="Free plan doesn't require subscription")
        
        # Check for existing active subscription
        existing = await db.subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"},
            {"_id": 0}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Already have an active subscription")
        
        price = plan["price_yearly"] if billing_period == "yearly" else plan["price_monthly"]
        duration_months = 12 if billing_period == "yearly" else 1
        
        subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
        
        subscription_doc = {
            "subscription_id": subscription_id,
            "user_id": user["user_id"],
            "plan_id": plan_id,
            "plan_name": plan["name"],
            "tier": plan["tier"],
            "billing_period": billing_period,
            "price": price,
            "status": "pending",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=30 * duration_months)).isoformat(),
            "auto_renew": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.subscriptions.insert_one(subscription_doc)
        
        # Create Stripe checkout session for payment
        import stripe_helper

        # Get origin URL
        origin_url = os.environ.get("PUBLIC_FRONTEND_URL", "http://localhost:3000")
        if request:
            origin_url = request.headers.get("Origin") or request.headers.get("Referer", "").rstrip("/") or origin_url

        success_url = f"{origin_url}/dashboard?subscription=success&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/dashboard?subscription=cancelled"

        session = stripe_helper.create_checkout_session(
            amount=float(price),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "subscription_id": subscription_id,
                "user_id": user["user_id"],
                "plan_id": plan_id,
                "type": "subscription",
            },
            product_name=f"Subscription: {plan['name']}",
        )

        await db.subscriptions.update_one(
            {"subscription_id": subscription_id},
            {"$set": {"session_id": session.session_id}}
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "subscription_id": subscription_id
        }

    @router.post("/cancel")
    async def cancel_subscription(user = Depends(get_current_user)):
        """Cancel current subscription"""
        subscription = await db.subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"},
            {"_id": 0}
        )
        
        if not subscription:
            raise HTTPException(status_code=400, detail="No active subscription found")
        
        await db.subscriptions.update_one(
            {"subscription_id": subscription["subscription_id"]},
            {"$set": {"status": "cancelled", "auto_renew": False}}
        )
        
        return {"message": "Subscription cancelled. Access continues until end of billing period."}

    # ============= PARTNERSHIP ENDPOINTS =============

    @router.get("/partnerships/tiers")
    async def get_partnership_tiers():
        """Get available partnership tiers"""
        return {"tiers": PARTNERSHIP_TIERS}

    @router.post("/partnerships/apply")
    async def apply_for_partnership(
        application: PartnershipApplication,
        user = Depends(get_current_user)
    ):
        """Apply for business partnership"""
        if user.get("account_type") != "business":
            raise HTTPException(status_code=403, detail="Business account required")
        
        application_id = f"partner_app_{uuid.uuid4().hex[:12]}"
        
        application_doc = {
            "application_id": application_id,
            "user_id": user["user_id"],
            "business_name": application.business_name,
            "contact_email": application.contact_email,
            "contact_phone": application.contact_phone,
            "business_type": application.business_type,
            "description": application.description,
            "website": application.website,
            "expected_monthly_events": application.expected_monthly_events,
            "status": "pending",  # pending, approved, rejected
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.partnership_applications.insert_one(application_doc)
        
        return {
            "application_id": application_id,
            "status": "pending",
            "message": "Your partnership application has been submitted. We'll review and contact you within 2-3 business days."
        }

    # ============= SPONSORED LISTINGS ENDPOINTS =============

    @router.get("/sponsored/packages")
    async def get_sponsored_packages():
        """Get available sponsored listing packages"""
        return {"packages": SPONSORED_LISTING_PACKAGES}

    @router.post("/sponsored/create")
    async def create_sponsored_listing(
        package_id: str,
        listing_type: str,  # featured_event, top_restaurant, promoted_attraction
        target_id: str,
        request = None,
        user = Depends(get_current_user)
    ):
        """Create a sponsored listing"""
        # Beta block: don't initiate Stripe checkouts during beta
        if os.environ.get("BETA_PAYMENTS_DISABLED", "true").lower() == "true":
            raise HTTPException(
                status_code=503,
                detail="Sponsored listings are disabled during the NearScene beta. Email steinackerr@gmail.com if you'd like to participate in a monetization preview."
            )
        package = next((p for p in SPONSORED_LISTING_PACKAGES if p["package_id"] == package_id), None)
        if not package:
            raise HTTPException(status_code=400, detail="Invalid package")
        
        # Verify target exists and user owns it
        if listing_type == "featured_event":
            target = await db.events.find_one({"event_id": target_id}, {"_id": 0})
            if not target or target.get("organizer_id") != user["user_id"]:
                raise HTTPException(status_code=403, detail="Event not found or not authorized")
        elif listing_type == "top_restaurant":
            target = await db.restaurants.find_one({"restaurant_id": target_id}, {"_id": 0})
            # For demo, allow any business user
            if not target:
                raise HTTPException(status_code=404, detail="Restaurant not found")
        elif listing_type == "promoted_attraction":
            target = await db.attractions.find_one({"attraction_id": target_id}, {"_id": 0})
            if not target:
                raise HTTPException(status_code=404, detail="Attraction not found")
        else:
            raise HTTPException(status_code=400, detail="Invalid listing type")
        
        listing_id = f"sponsored_{uuid.uuid4().hex[:12]}"
        
        listing_doc = {
            "listing_id": listing_id,
            "business_id": user["user_id"],
            "business_name": user.get("business_name") or user["name"],
            "listing_type": listing_type,
            "target_id": target_id,
            "package_id": package_id,
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=package["duration_days"])).isoformat(),
            "impressions": 0,
            "clicks": 0,
            "budget": package["price"],
            "spent": 0,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.sponsored_listings.insert_one(listing_doc)
        
        # Create payment checkout
        import stripe_helper

        origin_url = os.environ.get("PUBLIC_FRONTEND_URL", "http://localhost:3000")
        if request:
            origin_url = request.headers.get("Origin") or request.headers.get("Referer", "").rstrip("/") or origin_url

        success_url = f"{origin_url}/dashboard?sponsored=success&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/dashboard"

        session = stripe_helper.create_checkout_session(
            amount=float(package["price"]),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "listing_id": listing_id,
                "user_id": user["user_id"],
                "type": "sponsored_listing",
            },
            product_name=f"Sponsored Listing: {package['name']}",
        )

        await db.sponsored_listings.update_one(
            {"listing_id": listing_id},
            {"$set": {"session_id": session.session_id}}
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "listing_id": listing_id
        }

    @router.get("/sponsored/my-listings")
    async def get_my_sponsored_listings(user = Depends(get_current_user)):
        """Get user's sponsored listings"""
        listings = await db.sponsored_listings.find(
            {"business_id": user["user_id"]},
            {"_id": 0}
        ).to_list(50)
        
        for listing in listings:
            if isinstance(listing.get("start_date"), str):
                listing["start_date"] = datetime.fromisoformat(listing["start_date"])
            if isinstance(listing.get("end_date"), str):
                listing["end_date"] = datetime.fromisoformat(listing["end_date"])
        
        return {"listings": listings}

    # ============= COMMISSION TRACKING ENDPOINTS =============

    @router.get("/commission/summary")
    async def get_commission_summary(user = Depends(get_current_user)):
        """Get commission summary for business users"""
        if user.get("account_type") != "business":
            raise HTTPException(status_code=403, detail="Business account required")
        
        # Get user's subscription tier for commission rate
        subscription = await db.subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"},
            {"_id": 0}
        )
        
        tier = subscription["tier"] if subscription else "free"
        commission_rate = {
            "free": 0.05,
            "basic": 0.05,
            "premium": 0.05,
            "business": 0.03
        }.get(tier, 0.05)
        
        # Get all tickets sold for user's events
        user_events = await db.events.find(
            {"organizer_id": user["user_id"]},
            {"_id": 0, "event_id": 1}
        ).to_list(100)
        
        event_ids = [e["event_id"] for e in user_events]
        
        tickets = await db.tickets.find(
            {"event_id": {"$in": event_ids}, "payment_status": "paid"},
            {"_id": 0}
        ).to_list(1000)
        
        total_revenue = sum(t.get("total_price", 0) for t in tickets)
        total_commission = sum(t.get("commission", 0) for t in tickets)
        net_revenue = total_revenue - total_commission
        
        return {
            "tier": tier,
            "commission_rate": f"{commission_rate * 100}%",
            "total_revenue": round(total_revenue, 2),
            "total_commission": round(total_commission, 2),
            "net_revenue": round(net_revenue, 2),
            "total_tickets_sold": len(tickets),
            "events_count": len(event_ids)
        }

    # ============= PREMIUM FEATURES CHECK =============

    @router.get("/features/check")
    async def check_premium_features(user = Depends(get_optional_user)):
        """Check which premium features user has access to"""
        if not user:
            return {
                "tier": "free",
                "features": {
                    "unlimited_favorites": False,
                    "early_access": False,
                    "exclusive_discounts": False,
                    "ad_free": False,
                    "ai_recommendations": False,
                    "vip_events": False,
                    "concierge": False,
                    "monthly_credit": 0,
                    "reduced_commission": False
                }
            }
        
        subscription = await db.subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"},
            {"_id": 0}
        )
        
        tier = subscription["tier"] if subscription else "free"
        
        features = {
            "free": {
                "unlimited_favorites": False,
                "early_access": False,
                "exclusive_discounts": False,
                "ad_free": False,
                "ai_recommendations": False,
                "vip_events": False,
                "concierge": False,
                "monthly_credit": 0,
                "reduced_commission": False
            },
            "basic": {
                "unlimited_favorites": True,
                "early_access": True,
                "exclusive_discounts": True,
                "ad_free": True,
                "ai_recommendations": False,
                "vip_events": False,
                "concierge": False,
                "monthly_credit": 0,
                "reduced_commission": False
            },
            "premium": {
                "unlimited_favorites": True,
                "early_access": True,
                "exclusive_discounts": True,
                "ad_free": True,
                "ai_recommendations": True,
                "vip_events": True,
                "concierge": True,
                "monthly_credit": 10,
                "reduced_commission": False
            },
            "business": {
                "unlimited_favorites": True,
                "early_access": True,
                "exclusive_discounts": True,
                "ad_free": True,
                "ai_recommendations": True,
                "vip_events": True,
                "concierge": True,
                "monthly_credit": 0,
                "reduced_commission": True
            }
        }
        
        return {
            "tier": tier,
            "features": features.get(tier, features["free"])
        }

    return router
