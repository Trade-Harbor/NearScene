# LocalVibe - Local Events Discovery Platform

## Original Problem Statement
Build an app for what's happening locally with:
- Events within 25 mile radius with options to search further distances
- Personal and business accounts for user interaction (post, comment, review)
- Interactive map for food truck locations
- Upcoming events: concerts, parades, marathons, markets, happy hours, garage sales
- Filters for specific event types
- Business promotions (paid top feed displays)
- Garage sales and local events posting
- Ticket sales with commission system
- Support for every US zip code

## User Choices
- Authentication: JWT + Emergent Google OAuth
- Payments: Stripe & PayPal
- Maps: OpenStreetMap/Leaflet (free)
- AI: Gemini for recommendations and smart search
- Theme: Vibrant/Colorful with Dark Mode

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + TailwindCSS + Shadcn UI
- **Maps**: react-leaflet with OpenStreetMap
- **Payments**: Stripe checkout sessions, PayPal integration
- **AI**: Gemini 3 Flash via emergentintegrations

## Core Requirements
1. **Event Discovery** - Location-based event feed with distance filtering
2. **User Accounts** - Personal and business account types
3. **Event Categories** - Concerts, parades, marathons, markets, happy hours, garage sales, food festivals, community events, sports
4. **Food Truck Map** - Interactive map showing daily food truck locations
5. **Comments & Reviews** - User interaction on events and food trucks
6. **Ticket Sales** - With 5% commission on paid events
7. **Business Promotions** - Paid featured placement packages

## What's Been Implemented (Jan 2026)
- [x] Homepage with hero, search, categories, and featured events
- [x] Events page with filters (category, date, free/paid, distance radius)
- [x] Event detail page with full info, ticket purchase, comments
- [x] Food trucks page with interactive map and list view
- [x] User authentication (JWT + Google OAuth)
- [x] Personal and business account registration
- [x] Create event form with all fields (paid/free, discounts, tickets)
- [x] Dark mode toggle
- [x] Dashboard with stats, events management, tickets, promotions
- [x] Stripe checkout for ticket purchases and promotions
- [x] AI recommendations endpoint (Gemini integration)
- [x] Sample data seeding for demo

## API Endpoints
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- GET /api/auth/session - Google OAuth callback
- GET /api/events - List events with filters
- POST /api/events - Create event
- GET /api/events/{id} - Event detail
- GET /api/foodtrucks - List food trucks
- POST /api/foodtrucks - Create food truck
- POST /api/payments/checkout/ticket - Ticket purchase
- POST /api/payments/checkout/promotion - Promotion purchase
- POST /api/ai/recommend - AI recommendations
- POST /api/ai/search - AI-powered search

## Prioritized Backlog

### P0 (Critical)
- ✅ All P0 features implemented

### P1 (High Priority)
- [ ] Email notifications for ticket purchases
- [ ] Event reminders
- [ ] Full PayPal checkout integration
- [ ] Event editing functionality
- [ ] User profile page

### P2 (Medium Priority)
- [ ] Event sharing to social media
- [ ] Saved/favorited events
- [ ] Event attendance tracking
- [ ] Food truck menu upload
- [ ] Business analytics dashboard

### P3 (Nice to Have)
- [ ] Push notifications
- [ ] Event calendar view
- [ ] Multi-image gallery for events
- [ ] Review moderation
- [ ] Admin dashboard

## Next Tasks
1. Add email notifications for ticket purchases
2. Implement event editing for organizers
3. Add PayPal checkout session completion
4. Create user profile page with saved events
5. Add business analytics for event organizers
