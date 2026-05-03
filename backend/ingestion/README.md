# NearScene Ingestion Pipeline

Pulls real event/restaurant data from public APIs and merges it into the NearScene
database. Pilot region: **Wilmington, NC** + 30-mile radius.

## What it does

| Source | Pulls | Free tier |
|--------|-------|-----------|
| Ticketmaster Discovery | Concerts, sports, theater, ticketed events | 5,000 calls/day |
| SeatGeek | Concerts, sports, theater (different inventory than TM) | Generous, no published cap |
| Yelp Fusion | Restaurants, bars, food businesses | 5,000 calls/day |

Same event reported by both Ticketmaster and SeatGeek is deduped automatically
via a content hash on `(title, start_date, location_name)`. Re-running the
pipeline never creates duplicates — already-imported records are skipped.

User-submitted events and restaurants are **never touched** by ingestion.

## API key signup (all instant + free)

### Ticketmaster
1. Go to https://developer.ticketmaster.com/user/register
2. Create an account, verify email
3. https://developer.ticketmaster.com/user/me/apps → "Add a New App"
4. Copy the **Consumer Key** → set as `TICKETMASTER_API_KEY` in Render

### SeatGeek
1. Go to https://seatgeek.com/account/develop
2. Sign in (or sign up — free)
3. Create a new app
4. Copy the **Client ID** → set as `SEATGEEK_CLIENT_ID` in Render

### Yelp Fusion
1. Go to https://www.yelp.com/developers/v3/manage_app
2. Sign in / sign up (free)
3. Create a new app — fill in name + website (use your Vercel URL)
4. Copy the **API Key** → set as `YELP_API_KEY` in Render

## Setting the keys in Render

1. Render dashboard → `nearscene-backend` service → Environment tab
2. Add the three keys above plus `ADMIN_TOKEN` (any random string you'll use to trigger ingestion manually — e.g. generate one with `openssl rand -hex 16`)
3. Save — Render auto-redeploys (~2 min)
4. The cron `nearscene-ingestion-daily` will inherit these via `fromService` references in `render.yaml`

## Running ingestion

### Manually (via API)
After deploy, hit:
```
curl -X POST https://YOUR-RENDER-URL.onrender.com/api/admin/ingest \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN"
```
Returns a JSON summary: how many events/restaurants were inserted, skipped, or considered.

### View recent runs
```
curl https://YOUR-RENDER-URL.onrender.com/api/admin/ingestion-runs \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN"
```

### Automatic
The cron job runs daily at 09:00 UTC (~5am ET). View its history in Render under
the `nearscene-ingestion-daily` service.

## Tuning the pilot region

Override these env vars on either service if you want to expand the radius
or move the pilot:
- `PILOT_LAT` (default `34.2257` — Wilmington, NC)
- `PILOT_LON` (default `-77.9447`)
- `PILOT_RADIUS_MILES` (default `30`)
- `PILOT_CITY`, `PILOT_STATE` (used in metadata only)

## Adding a new source

1. Create `backend/ingestion/<source>.py` with an async `fetch_events()` (or
   `fetch_restaurants()`) function that returns a list of dicts in NearScene's
   schema (see `ticketmaster.py` for the canonical event shape).
2. Mark each record with `_source`, `_source_id`, `_source_url`.
3. Import and call from `runner.py`.

That's it — dedup, source tracking, and audit logging are handled centrally.
