"""Build the weekly LocalDrift email digest.

Pulls the top events for an upcoming date range plus a small handful
of featured restaurants/attractions, and renders to a plain HTML string
that's safe to drop into an email client. Inline styles only — no
linked CSS — because email clients are hostile to anything fancier.

Public surface:
    generate_digest_html(db, *, start_iso, end_iso, site_url) -> str
    generate_digest_subject(start_iso, end_iso) -> str
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from html import escape


PRIMARY = "#1e6b6b"
ACCENT = "#f97316"


def _fmt_date(iso: str | datetime) -> str:
    if isinstance(iso, str):
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        except ValueError:
            return iso
    else:
        dt = iso
    return dt.strftime("%a %b %-d") if hasattr(dt, "strftime") else str(dt)


def _fmt_time(iso: str | datetime) -> str:
    if isinstance(iso, str):
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        except ValueError:
            return ""
    else:
        dt = iso
    try:
        return dt.strftime("%-I:%M %p").lstrip("0")
    except (ValueError, AttributeError):
        return ""


def generate_digest_subject(start_iso: str, end_iso: str) -> str:
    """Subject line: 'This weekend in Wilmington — May 9-11'."""
    try:
        s = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        e = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    except ValueError:
        return "What's happening in Wilmington this week"
    same_month = s.month == e.month
    s_label = s.strftime("%b %-d") if hasattr(s, "strftime") else str(s)
    e_label = e.strftime("%-d") if same_month else e.strftime("%b %-d")
    return f"What's happening in Wilmington — {s_label}-{e_label}"


async def _top_events(db, start_iso: str, end_iso: str, limit: int = 10) -> list[dict]:
    cursor = (
        db.events
        .find(
            {"start_date": {"$gte": start_iso, "$lte": end_iso}},
            {"_id": 0},
        )
        .sort("start_date", 1)
        .limit(limit)
    )
    return await cursor.to_list(limit)


async def _featured_restaurants(db, limit: int = 4) -> list[dict]:
    cursor = (
        db.restaurants
        .find({}, {"_id": 0})
        .sort("rating", -1)
        .limit(limit)
    )
    return await cursor.to_list(limit)


async def _featured_attractions(db, limit: int = 3) -> list[dict]:
    cursor = (
        db.attractions
        .find({"attraction_type": {"$in": ["park", "beach", "garden", "nature_reserve"]}}, {"_id": 0})
        .limit(limit)
    )
    return await cursor.to_list(limit)


def _event_card(event: dict, site_url: str) -> str:
    title = escape(event.get("title", "Untitled event"))
    venue = escape(event.get("location_name") or event.get("city", ""))
    date_label = _fmt_date(event.get("start_date", ""))
    time_label = _fmt_time(event.get("start_date", ""))
    when = f"{date_label} · {time_label}" if time_label else date_label
    link = f"{site_url}/events/{event.get('event_id', '')}"

    return f"""
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
        <a href="{link}" style="color:#111827;text-decoration:none;">
          <div style="font-size:16px;font-weight:600;line-height:1.3;margin-bottom:4px;">{title}</div>
          <div style="font-size:13px;color:#6b7280;">{escape(when)} · {venue}</div>
        </a>
      </td>
    </tr>
    """


def _venue_card(item: dict, kind: str, site_url: str) -> str:
    name = escape(item.get("name", ""))
    sub = escape((item.get("city") or item.get("category") or "").replace("_", " "))
    if kind == "restaurant":
        link = f"{site_url}/restaurants/{item.get('restaurant_id', '')}"
    else:
        link = f"{site_url}/attractions/{item.get('attraction_id', '')}"

    return f"""
    <td style="padding:8px;width:50%;vertical-align:top;">
      <a href="{link}" style="display:block;padding:12px;background:#f9fafb;border-radius:10px;text-decoration:none;color:#111827;">
        <div style="font-size:14px;font-weight:600;margin-bottom:2px;">{name}</div>
        <div style="font-size:12px;color:#6b7280;">{sub}</div>
      </a>
    </td>
    """


async def generate_digest_html(
    db,
    *,
    start_iso: str,
    end_iso: str,
    site_url: str = "https://www.localdrift.app",
) -> str:
    events = await _top_events(db, start_iso, end_iso)
    rests = await _featured_restaurants(db)
    attrs = await _featured_attractions(db)

    events_html = "".join(_event_card(e, site_url) for e in events) or """
        <tr><td style="padding:16px 0;color:#6b7280;font-size:14px;">
            No events on the calendar yet — check back soon.
        </td></tr>
    """

    # Two-column grids for venue cards
    def grid(items, kind):
        cells = [_venue_card(i, kind, site_url) for i in items]
        rows = ""
        for i in range(0, len(cells), 2):
            row_cells = "".join(cells[i:i+2])
            rows += f"<tr>{row_cells}</tr>"
        return rows

    rests_html = grid(rests, "restaurant")
    attrs_html = grid(attrs, "attraction")

    range_label = f"{_fmt_date(start_iso)} – {_fmt_date(end_iso)}"

    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:{PRIMARY};padding:32px 24px;text-align:center;">
          <div style="font-size:14px;color:#ffffff;opacity:0.85;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">LocalDrift Weekly</div>
          <div style="font-size:24px;color:#ffffff;font-weight:700;">{range_label}</div>
        </td></tr>

        <!-- Events -->
        <tr><td style="padding:24px;">
          <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px;">
            🎟️  Upcoming events
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            {events_html}
          </table>
          <div style="margin-top:16px;">
            <a href="{site_url}/events" style="font-size:14px;color:{PRIMARY};text-decoration:none;font-weight:600;">See all events →</a>
          </div>
        </td></tr>

        <!-- Restaurants -->
        <tr><td style="padding:0 16px 16px 16px;">
          <div style="padding:0 8px;font-size:18px;font-weight:700;color:#111827;margin-bottom:8px;">
            🍽️  Top-rated restaurants
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">{rests_html}</table>
        </td></tr>

        <!-- Attractions -->
        <tr><td style="padding:0 16px 24px 16px;">
          <div style="padding:0 8px;font-size:18px;font-weight:700;color:#111827;margin-bottom:8px;">
            🌳  Get outside
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">{attrs_html}</table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px;background:#f9fafb;text-align:center;font-size:12px;color:#6b7280;">
          You're receiving this because you signed up for LocalDrift updates.<br>
          <a href="{site_url}/unsubscribe?email={{{{EMAIL}}}}" style="color:{PRIMARY};">Unsubscribe</a> ·
          <a href="{site_url}" style="color:{PRIMARY};">localdrift.app</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
"""
