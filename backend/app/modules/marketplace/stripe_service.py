"""
Stripe integration for stand marketplace.
Completely isolated — does NOT touch the event manual payment system.
Uses stripe.checkout.Session for one-time product purchases.
"""

import logging
from typing import Optional

import stripe

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _configure() -> None:
    """Lazy-configure the stripe SDK from env."""
    s = get_settings()
    key = getattr(s, "STRIPE_SECRET_KEY", None) or ""
    if key:
        stripe.api_key = key


def create_checkout_session(
    *,
    product_name: str,
    unit_price_cents: int,
    currency: str,
    quantity: int,
    order_id: str,
    success_url: str,
    cancel_url: str,
    buyer_email: Optional[str] = None,
) -> stripe.checkout.Session:
    """
    Create a Stripe Checkout Session for a single stand product purchase.
    Returns the full Session object (caller reads .url and .id).
    """
    _configure()

    line_items = [
        {
            "price_data": {
                "currency": currency.lower(),
                "unit_amount": unit_price_cents,
                "product_data": {"name": product_name},
            },
            "quantity": quantity,
        }
    ]

    params: dict = {
        "mode": "payment",
        "line_items": line_items,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"order_id": order_id},
    }
    if buyer_email:
        params["customer_email"] = buyer_email

    session = stripe.checkout.Session.create(**params)
    return session


def create_cart_checkout_session(
    *,
    items: list[dict],
    order_ids: list[str],
    success_url: str,
    cancel_url: str,
    buyer_email: Optional[str] = None,
) -> stripe.checkout.Session:
    """
    Create a Stripe Checkout Session for multiple products (cart).
    items: list of {product_name, unit_price_cents, currency, quantity}
    """
    _configure()

    line_items = [
        {
            "price_data": {
                "currency": item["currency"].lower(),
                "unit_amount": item["unit_price_cents"],
                "product_data": {"name": item["product_name"]},
            },
            "quantity": item["quantity"],
        }
        for item in items
    ]

    params: dict = {
        "mode": "payment",
        "line_items": line_items,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"order_ids": ",".join(order_ids)},
    }
    if buyer_email:
        params["customer_email"] = buyer_email

    session = stripe.checkout.Session.create(**params)
    return session


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """
    Verify a Stripe webhook event using the webhook secret.
    Returns the parsed event dict.
    Raises stripe.error.SignatureVerificationError on failure.
    """
    _configure()
    s = get_settings()
    secret = getattr(s, "STRIPE_WEBHOOK_SECRET", None) or ""
    event = stripe.Webhook.construct_event(payload, sig_header, secret)
    return event
