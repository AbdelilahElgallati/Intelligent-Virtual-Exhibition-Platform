"""
Payments module router for IVEP.

Payzone-based event ticket payments for visitors.
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
    get_payment_by_payzone_id,
    get_user_payment,
    get_user_payment_by_status,
    list_payments,
    mark_payment_paid,
)
from app.modules.marketplace.payzone_service import (
    create_payment_session,
    check_payment_status,
    verify_callback_signature,
)

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
    Create a Payzone payment session for a paid event ticket.
    Returns the Payzone payment URL to redirect the browser to.
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
    currency = "MAD"
    amount_cents = int(math.ceil(amount * 100))

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
    backend_base = str(request.base_url).rstrip("/")
    success_url = f"{origin}/events/{event_id}/payment?success=true&payment_id={{PAYMENT_ID}}"
    cancel_url = f"{origin}/events/{event_id}/payment?cancelled=true"
    notification_url = f"{backend_base}/events/{event_id}/payment-callback"

    try:
        pz_result = await create_payment_session(
            order_id=payment["_id"],
            amount_cents=amount_cents,
            currency=currency,
            description=f"Ticket: {event['title']}",
            success_url=success_url,
            cancel_url=cancel_url,
            notification_url=notification_url,
            customer_email=current_user.get("email"),
            customer_name=current_user.get("full_name", current_user.get("name", "")),
            metadata={
                "payment_id": payment["_id"],
                "event_id": event_id,
                "user_id": str(current_user["_id"]),
            },
        )
    except Exception as exc:
        logger.error("Payzone checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update payment with payzone payment id
    from app.db.mongo import get_database
    from bson import ObjectId

    await get_database()["event_payments"].update_one(
        {"_id": ObjectId(payment["_id"]) if ObjectId.is_valid(payment["_id"]) else payment["_id"]},
        {"$set": {"payzone_payment_id": pz_result["payment_id"]}},
    )

    return {"payment_url": pz_result["payment_url"], "payment_id": payment["_id"]}


@router.post("/events/{event_id}/verify-payment")
async def verify_event_payment(
    event_id: str,
    request: Request,
    current_user: dict = Depends(require_role(Role.VISITOR)),
):
    """
    Verify a Payzone payment after the visitor returns from checkout.
    Called by the frontend with payment_id.
    On success: marks payment as paid, creates APPROVED participant, notifies.
    """
    body = await request.json()
    payment_id = body.get("payment_id", "")
    if not payment_id:
        raise HTTPException(status_code=400, detail="payment_id is required")

    # Find the payment record by our internal _id
    payment = await get_payment_by_id(payment_id)
    if not payment:
        # Try by payzone payment id
        payment = await get_payment_by_payzone_id(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    if payment["status"] == PaymentStatus.PAID:
        return {"status": "already_paid", "message": "Payment already confirmed."}

    # Verify it belongs to this user and event
    if payment["event_id"] != event_id or payment["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Payment does not match")

    # Check payment status with Payzone
    pz_payment_id = payment.get("payzone_payment_id", "")
    if pz_payment_id:
        try:
            pz_status = await check_payment_status(pz_payment_id)
            if pz_status.get("status") != "completed":
                raise HTTPException(status_code=400, detail="Payment not completed")
            transaction_id = pz_status.get("transaction_id", "")
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Failed to check Payzone status: %s", exc)
            raise HTTPException(status_code=400, detail="Could not verify payment status")
    else:
        transaction_id = ""

    # Mark as paid
    await mark_payment_paid(payment["_id"], transaction_id)

    # Auto-approve participant
    existing = await get_user_participation(event_id, current_user["_id"])
    if not existing:
        participant = await request_to_join(event_id, current_user["_id"])
        from app.modules.participants.service import approve_participant
        await approve_participant(participant["_id"])
    elif existing["status"] != ParticipantStatus.APPROVED:
        from app.modules.participants.service import approve_participant
        await approve_participant(existing["_id"])

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event_payment_completed",
        entity="event_payment",
        entity_id=payment["_id"],
        metadata={"event_id": event_id, "payzone_payment_id": pz_payment_id},
    )

    # Notify visitor
    event = await get_event_by_id(event_id)
    event_title = event["title"] if event else "an event"
    await create_notification(
        user_id=str(current_user["_id"]),
        type=NotificationType.PAYMENT_CONFIRMED,
        message=f"Your payment for '{event_title}' has been confirmed. You can now enter the event!",
    )

    return {"status": "paid", "message": "Payment confirmed. You now have access to the event."}


@router.post("/events/{event_id}/payment-callback")
async def event_payment_callback(event_id: str, request: Request):
    """
    Payzone server-to-server callback for event payments.
    No auth — Payzone signs the payload.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    received_sig = body.get("signature", "")
    if not verify_callback_signature(body, received_sig):
        logger.warning("Payzone event payment callback signature failed")
        raise HTTPException(status_code=400, detail="Invalid signature")

    payment_status = body.get("status", "")
    pz_payment_id = body.get("payment_id", "")
    transaction_id = body.get("transaction_id", "")
    order_id = body.get("order_id", "")

    if payment_status == "completed":
        # Find payment record
        payment = None
        if order_id:
            payment = await get_payment_by_id(order_id)
        if not payment and pz_payment_id:
            payment = await get_payment_by_payzone_id(pz_payment_id)

        if payment and payment["status"] != PaymentStatus.PAID:
            await mark_payment_paid(payment["_id"], transaction_id)

            # Auto-approve participant
            user_id = payment["user_id"]
            ev_id = payment["event_id"]
            existing = await get_user_participation(ev_id, user_id)
            if not existing:
                participant = await request_to_join(ev_id, user_id)
                from app.modules.participants.service import approve_participant
                await approve_participant(participant["_id"])
            elif existing["status"] != ParticipantStatus.APPROVED:
                from app.modules.participants.service import approve_participant
                await approve_participant(existing["_id"])

            logger.info("Event payment %s confirmed via Payzone callback", payment["_id"])

    return {"status": "ok"}


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
        payzone_payment_id=payment.get("payzone_payment_id"),
    )


@router.get("/events/{event_id}/my-receipt")
async def get_my_receipt(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a receipt for a paid event payment.
    Returns receipt data that the frontend can display/download.
    """
    payment = await get_user_payment(event_id, current_user["_id"])
    if not payment or payment["status"] != PaymentStatus.PAID:
        raise HTTPException(status_code=404, detail="No paid payment found for this event")

    event = await get_event_by_id(event_id)
    event_title = event["title"] if event else "Unknown Event"

    receipt = {
        "receipt_id": payment["_id"],
        "event_id": event_id,
        "event_title": event_title,
        "payer_name": current_user.get("full_name", current_user.get("name", "")),
        "payer_email": current_user.get("email", ""),
        "amount": payment["amount"],
        "currency": payment.get("currency", "MAD").upper(),
        "status": payment["status"],
        "payment_method": "Payzone",
        "payzone_payment_id": payment.get("payzone_payment_id", ""),
        "payzone_transaction_id": payment.get("payzone_transaction_id", ""),
        "created_at": payment["created_at"].isoformat() if hasattr(payment.get("created_at", ""), "isoformat") else str(payment.get("created_at", "")),
        "paid_at": payment["paid_at"].isoformat() if payment.get("paid_at") and hasattr(payment["paid_at"], "isoformat") else str(payment.get("paid_at", "")),
    }

    return receipt


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
