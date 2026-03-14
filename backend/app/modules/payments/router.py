"""
Payments module router for IVEP.

Stripe-based event ticket payments for visitors.
"""

import logging
import math

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.dependencies import get_current_user, require_role
from app.modules.auth.enums import Role
from app.modules.audit.service import log_audit
from app.modules.events.service import get_event_by_id
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import create_notification
from app.modules.participants.schemas import ParticipantStatus
from app.modules.participants.service import (
    get_user_participation,
    request_to_join,
)
from app.modules.payments.schemas import (
    EventPaymentRead,
    PaymentStatus,
    PaymentStatusResponse,
)
from app.modules.payments.service import (
    create_payment,
    get_payment_by_id,
    get_payment_by_stripe_session,
    get_user_payment,
    get_user_payment_by_status,
    list_payments,
    mark_payment_paid,
)
from app.modules.marketplace.stripe_service import _configure as _stripe_configure
from app.modules.analytics.service import log_event_persistent
from app.modules.analytics.schemas import AnalyticsEventType

import stripe

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Payments"])


# ============== Visitor Endpoints ==============


@router.post("/events/{event_id}/checkout")
async def create_event_checkout(
    event_id: str,
    request: Request,
    current_user: dict = Depends(require_role(Role.VISITOR)),
):
    """
    Create a Stripe Checkout session for a paid event ticket.
    Returns the Stripe session URL to redirect the browser to.
    """
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.get("is_paid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This event is free — no payment required.",
        )

    # Block if already paid
    existing_paid = await get_user_payment_by_status(
        event_id, current_user["_id"], PaymentStatus.PAID
    )
    if existing_paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already paid for this event.",
        )

    amount = event.get("ticket_price", 0) or 0
    currency = "mad"
    unit_price_cents = int(math.ceil(amount * 100))

    # Create pending payment record
    payment = await create_payment(
        event_id=event_id,
        user_id=current_user["_id"],
        amount=amount,
        currency=currency,
    )

    # Build success/cancel URLs
    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    success_url = f"{origin}/events/{event_id}/payment?success=true&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/events/{event_id}/payment?cancelled=true"

    _stripe_configure()

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": currency.lower(),
                        "unit_amount": unit_price_cents,
                        "product_data": {"name": f"Ticket: {event['title']}"},
                    },
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=current_user.get("email"),
            metadata={
                "payment_id": payment["_id"],
                "event_id": event_id,
                "user_id": str(current_user["_id"]),
            },
        )
    except Exception as exc:
        logger.error("Stripe checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update payment with stripe session id
    from app.db.mongo import get_database
    from bson import ObjectId

    await get_database()["event_payments"].update_one(
        {"_id": ObjectId(payment["_id"]) if ObjectId.is_valid(payment["_id"]) else payment["_id"]},
        {"$set": {"stripe_session_id": session.id}},
    )

    return {"session_url": session.url, "payment_id": payment["_id"]}


@router.post("/events/{event_id}/verify-payment")
async def verify_event_payment(
    event_id: str,
    request: Request,
    current_user: dict = Depends(require_role(Role.VISITOR)),
):
    """
    Verify a Stripe payment after the visitor returns from checkout.
    Called by the frontend with ?session_id=xxx.
    On success: marks payment as paid, creates APPROVED participant, notifies.
    """
    body = await request.json()
    session_id = body.get("session_id", "")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    _stripe_configure()

    # Retrieve the Stripe session to verify payment
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        logger.error("Failed to retrieve Stripe session: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid session")

    if session.payment_status != "paid":
        raise HTTPException(status_code=400, detail="Payment not completed")

    # Find the payment record
    payment = await get_payment_by_stripe_session(session_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    if payment["status"] == PaymentStatus.PAID:
        return {"status": "already_paid", "message": "Payment already confirmed."}

    # Verify it belongs to this user and event
    if payment["event_id"] != event_id or payment["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Payment does not match")

    # Mark as paid
    payment_intent = session.payment_intent or ""
    await mark_payment_paid(payment["_id"], payment_intent)

    # Auto-approve participant
    existing = await get_user_participation(event_id, current_user["_id"])
    if not existing:
        participant = await request_to_join(event_id, current_user["_id"])
        from app.modules.participants.service import approve_participant
        await approve_participant(participant["_id"])
    elif existing["status"] != ParticipantStatus.APPROVED.value:
        from app.modules.participants.service import approve_participant
        await approve_participant(existing["_id"])

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event_payment_completed",
        entity="event_payment",
        entity_id=payment["_id"],
        metadata={"event_id": event_id, "stripe_session_id": session_id},
    )

    # Notify visitor
    event = await get_event_by_id(event_id)
    event_title = event["title"] if event else "an event"
    await create_notification(
        user_id=str(current_user["_id"]),
        type=NotificationType.PAYMENT_CONFIRMED,
        message=f"Your payment for '{event_title}' has been confirmed. You can now enter the event!",
    )

    # Best-effort analytics instrumentation.
    try:
        await log_event_persistent(
            type=AnalyticsEventType.PAYMENT_CONFIRMED,
            user_id=str(current_user["_id"]),
            event_id=str(event_id),
            metadata={
                "payment_id": payment.get("_id"),
                "stripe_session_id": session_id,
                "amount": payment.get("amount"),
                "currency": payment.get("currency"),
            },
        )
    except Exception:
        pass

    return {"status": "paid", "message": "Payment confirmed. You now have access to the event."}


@router.get("/events/{event_id}/my-payment-status", response_model=PaymentStatusResponse)
async def get_my_payment_status(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the current user's payment status for a specific event."""
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    payment = await get_user_payment(event_id, current_user["_id"])
    if not payment:
        return PaymentStatusResponse(status="none")

    return PaymentStatusResponse(
        status=payment["status"],
        stripe_session_id=payment.get("stripe_session_id"),
    )


@router.get("/events/{event_id}/my-receipt")
async def get_my_receipt(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get Stripe receipt URL for a paid event payment.
    The visitor can use this to download their receipt.
    """
    payment = await get_user_payment(event_id, current_user["_id"])
    if not payment or payment["status"] != PaymentStatus.PAID:
        raise HTTPException(status_code=404, detail="No paid payment found for this event")

    _stripe_configure()

    receipt_url = None
    payment_intent_id = payment.get("stripe_payment_intent")
    if payment_intent_id:
        try:
            pi = stripe.PaymentIntent.retrieve(payment_intent_id)
            if pi.latest_charge:
                charge = stripe.Charge.retrieve(pi.latest_charge)
                receipt_url = charge.receipt_url
        except Exception as exc:
            logger.error("Failed to get receipt: %s", exc)

    if not receipt_url:
        raise HTTPException(status_code=404, detail="Receipt not available yet")

    return {"receipt_url": receipt_url}


# ============== Admin Endpoints ==============


@router.get("/admin/event-payments", response_model=list[EventPaymentRead])
async def admin_list_event_payments(
    payment_status: str | None = None,
    event_id: str | None = None,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """List event payments (admin only). Filter by ?payment_status=paid&event_id=xxx."""
    status_filter = None
    if payment_status:
        try:
            status_filter = PaymentStatus(payment_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {payment_status}",
            )

    payments = await list_payments(status_filter=status_filter, event_id=event_id)
    return [EventPaymentRead(**p) for p in payments]
