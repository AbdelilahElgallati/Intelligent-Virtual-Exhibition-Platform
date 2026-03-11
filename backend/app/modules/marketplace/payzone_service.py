"""
Payzone.ma payment integration for IVEP.

Replaces Stripe with Payzone, Morocco's payment gateway.
Uses a redirect-based checkout flow:
  1. Backend initiates payment via Payzone API
  2. Customer is redirected to Payzone hosted payment page
  3. After payment, customer returns to success/cancel URL
  4. Payzone sends server-to-server callback to confirm payment

Used by both:
  - Stand marketplace (product/service purchases)
  - Visitor event ticket payments
  - Enterprise stand fee payments
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Payzone API base URL (configurable via env)
_PAYZONE_API_URL: str = ""
_PAYZONE_MERCHANT_ID: str = ""
_PAYZONE_API_KEY: str = ""
_PAYZONE_SECRET_KEY: str = ""


def _configure() -> None:
    """Lazy-load Payzone credentials from settings."""
    global _PAYZONE_API_URL, _PAYZONE_MERCHANT_ID, _PAYZONE_API_KEY, _PAYZONE_SECRET_KEY
    s = get_settings()
    _PAYZONE_API_URL = getattr(s, "PAYZONE_API_URL", "") or "https://checkout.payzone.ma/api"
    _PAYZONE_MERCHANT_ID = getattr(s, "PAYZONE_MERCHANT_ID", "") or ""
    _PAYZONE_API_KEY = getattr(s, "PAYZONE_API_KEY", "") or ""
    _PAYZONE_SECRET_KEY = getattr(s, "PAYZONE_SECRET_KEY", "") or ""


def _generate_signature(params: dict) -> str:
    """
    Generate HMAC-SHA256 signature for Payzone request/callback verification.
    Signs a sorted, pipe-delimited concatenation of param values.
    """
    _configure()
    sorted_keys = sorted(params.keys())
    message = "|".join(str(params[k]) for k in sorted_keys)
    signature = hmac.new(
        _PAYZONE_SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return signature


def verify_callback_signature(params: dict, received_signature: str) -> bool:
    """
    Verify the HMAC signature on a Payzone callback/notification.
    Returns True if signature matches.
    """
    # Build expected signature from callback params (excluding 'signature' itself)
    verify_params = {k: v for k, v in params.items() if k != "signature"}
    expected = _generate_signature(verify_params)
    return hmac.compare_digest(expected, received_signature)


async def create_payment_session(
    *,
    order_id: str,
    amount_cents: int,
    currency: str = "MAD",
    description: str = "",
    success_url: str,
    cancel_url: str,
    notification_url: str,
    customer_email: Optional[str] = None,
    customer_name: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Initiate a payment session with Payzone.

    Returns dict with:
      - payment_url: URL to redirect the customer to
      - payment_id: Payzone's payment reference
    """
    _configure()

    # Currency code: MAD = 504 (ISO 4217)
    currency_code = "504" if currency.upper() == "MAD" else currency

    params = {
        "merchant_id": _PAYZONE_MERCHANT_ID,
        "order_id": order_id,
        "amount": amount_cents,
        "currency": currency_code,
        "description": description[:255] if description else "Payment",
        "return_url": success_url,
        "cancel_url": cancel_url,
        "notification_url": notification_url,
        "language": "fr",
        "timestamp": str(int(time.time())),
    }

    if customer_email:
        params["customer_email"] = customer_email
    if customer_name:
        params["customer_name"] = customer_name[:100]
    if metadata:
        params["metadata"] = json.dumps(metadata)

    params["signature"] = _generate_signature(params)

    headers = {
        "Authorization": f"Bearer {_PAYZONE_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_PAYZONE_API_URL}/payment/init",
            json=params,
            headers=headers,
        )

    if resp.status_code not in (200, 201):
        logger.error("Payzone payment init failed: %s %s", resp.status_code, resp.text)
        raise RuntimeError(f"Payzone API error ({resp.status_code}): {resp.text}")

    data = resp.json()
    return {
        "payment_url": data.get("payment_url", ""),
        "payment_id": data.get("payment_id", data.get("transaction_id", "")),
    }


async def check_payment_status(payment_id: str) -> dict:
    """
    Query Payzone for the status of a payment.

    Returns dict with:
      - status: "completed" | "pending" | "failed" | "cancelled"
      - transaction_id: Payzone transaction reference
      - amount: amount in centimes
    """
    _configure()

    params = {
        "merchant_id": _PAYZONE_MERCHANT_ID,
        "payment_id": payment_id,
        "timestamp": str(int(time.time())),
    }
    params["signature"] = _generate_signature(params)

    headers = {
        "Authorization": f"Bearer {_PAYZONE_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_PAYZONE_API_URL}/payment/status",
            json=params,
            headers=headers,
        )

    if resp.status_code != 200:
        logger.error("Payzone status check failed: %s %s", resp.status_code, resp.text)
        raise RuntimeError(f"Payzone API error ({resp.status_code})")

    return resp.json()
