"""Thin wrapper around the official `stripe` Python SDK to replace the
Emergent-only `emergentintegrations.payments.stripe.checkout` module.

Provides the small surface area the rest of server.py needs:
  - create_checkout_session(amount, currency, success_url, cancel_url, metadata)
  - get_checkout_status(session_id)
  - handle_webhook(body, signature)
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any
import os
import stripe


@dataclass
class CheckoutSession:
    session_id: str
    url: str


@dataclass
class CheckoutStatus:
    status: str
    payment_status: str
    amount_total: Optional[int]
    currency: Optional[str]
    session_id: str
    metadata: Dict[str, Any]


@dataclass
class WebhookResult:
    session_id: Optional[str]
    payment_status: Optional[str]
    event_type: str
    metadata: Dict[str, Any]


def _configure(api_key: Optional[str] = None) -> None:
    stripe.api_key = api_key or os.environ.get("STRIPE_API_KEY", "")


def create_checkout_session(
    amount: float,
    currency: str,
    success_url: str,
    cancel_url: str,
    metadata: Optional[Dict[str, str]] = None,
    product_name: str = "NearScene Purchase",
) -> CheckoutSession:
    """Create a Stripe Checkout Session for a one-time payment."""
    _configure()
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": currency,
                "product_data": {"name": product_name},
                # Stripe expects amounts in the smallest unit (cents)
                "unit_amount": int(round(float(amount) * 100)),
            },
            "quantity": 1,
        }],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata or {},
    )
    return CheckoutSession(session_id=session.id, url=session.url)


def get_checkout_status(session_id: str) -> CheckoutStatus:
    """Retrieve a Checkout Session's current status."""
    _configure()
    session = stripe.checkout.Session.retrieve(session_id)
    return CheckoutStatus(
        status=session.status or "unknown",
        payment_status=session.payment_status or "unpaid",
        amount_total=session.amount_total,
        currency=session.currency,
        session_id=session.id,
        metadata=dict(session.metadata or {}),
    )


def handle_webhook(body: bytes, signature: Optional[str]) -> WebhookResult:
    """Verify and parse a Stripe webhook event.

    Requires STRIPE_WEBHOOK_SECRET env var to verify the signature.
    Falls back to unverified parsing if no secret configured (dev only).
    """
    _configure()
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    if webhook_secret and signature:
        event = stripe.Webhook.construct_event(body, signature, webhook_secret)
    else:
        # Dev fallback: parse without signature verification
        import json
        event = stripe.Event.construct_from(json.loads(body), stripe.api_key)

    session_id = None
    payment_status = None
    metadata: Dict[str, Any] = {}

    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        session_obj = event["data"]["object"]
        session_id = session_obj.get("id")
        payment_status = session_obj.get("payment_status")
        metadata = dict(session_obj.get("metadata") or {})

    return WebhookResult(
        session_id=session_id,
        payment_status=payment_status,
        event_type=event["type"],
        metadata=metadata,
    )
