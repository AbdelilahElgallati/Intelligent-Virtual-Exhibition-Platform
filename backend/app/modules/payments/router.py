"""
Payments module router for IVEP.

Handles visitor payment proof upload and admin payment review.
"""

import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.dependencies import get_current_user, require_role, require_roles
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
    PaymentRejectRequest,
    PaymentStatus,
    PaymentStatusResponse,
)
from app.modules.payments.service import (
    create_payment,
    get_payment_by_id,
    get_user_payment,
    get_user_payment_by_status,
    list_payments,
    update_payment_status,
)


# ── Constants ───────────────────────────────────────────────────────────────
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "payments")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}

router = APIRouter(tags=["Payments"])


# ============== Visitor Endpoints ==============


@router.post("/events/{event_id}/payment-proof", status_code=status.HTTP_201_CREATED)
async def submit_payment_proof(
    event_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(Role.VISITOR)),
):
    """
    Upload payment proof for a paid event.

    Accepts image/jpeg, image/png, or application/pdf (max 5 MB).
    Creates a pending EventPayment record.
    Prevents duplicate pending submissions.
    """
    # Validate event exists
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.get("is_paid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This event is free — no payment proof required.",
        )

    # Block duplicate pending payments
    existing_pending = await get_user_payment_by_status(
        event_id, current_user["_id"], PaymentStatus.PENDING
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending payment submission for this event.",
        )

    # Block if already approved
    existing_approved = await get_user_payment_by_status(
        event_id, current_user["_id"], PaymentStatus.APPROVED
    )
    if existing_approved:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your payment has already been approved.",
        )

    # Validate file type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' not allowed. Use JPEG, PNG, or PDF.",
        )

    # Read and validate file size
    file_data = await file.read()
    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 5 MB limit.",
        )

    # Save file to disk
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "proof")[1] or ".bin"
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(file_data)

    # Determine amount from event
    amount = event.get("ticket_price", 0) or 0

    # Create payment record
    payment = await create_payment(
        event_id=event_id,
        user_id=current_user["_id"],
        amount=amount,
        proof_file_path=f"uploads/payments/{unique_filename}",
    )

    return {
        "status": "pending",
        "message": "Payment proof submitted. Awaiting admin review.",
        "payment_id": payment["_id"],
    }


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
        admin_note=payment.get("admin_note"),
    )


# ============== Admin Review Endpoints ==============


@router.get("/admin/payments", response_model=list[EventPaymentRead])
async def admin_list_payments(
    payment_status: Optional[str] = None,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """List payment proof submissions (admin only). Filter by ?payment_status=pending."""
    status_filter = None
    if payment_status:
        try:
            status_filter = PaymentStatus(payment_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {payment_status}",
            )

    payments = await list_payments(status_filter=status_filter)
    return [EventPaymentRead(**p) for p in payments]


@router.patch("/admin/payments/{payment_id}/approve")
async def admin_approve_payment(
    payment_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Approve a payment proof submission.

    Sets status to 'approved', creates an APPROVED participant if not exists.
    """
    payment = await get_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment["status"] == PaymentStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is already approved.",
        )

    # Update payment status
    updated = await update_payment_status(payment_id, PaymentStatus.APPROVED)

    # Create participant with APPROVED status if not exists
    event_id = payment["event_id"]
    user_id = payment["user_id"]

    existing_participant = await get_user_participation(event_id, user_id)
    if not existing_participant:
        participant = await request_to_join(event_id, user_id)
        # Directly approve the participant
        from app.modules.participants.service import approve_participant
        await approve_participant(participant["_id"])
    elif existing_participant["status"] != ParticipantStatus.APPROVED:
        from app.modules.participants.service import approve_participant
        await approve_participant(existing_participant["_id"])

    # Log audit
    await log_audit(
        actor_id=current_user["_id"],
        action="payment_approved",
        entity="event_payment",
        entity_id=payment_id,
        metadata={"event_id": event_id, "user_id": user_id},
    )

    # Notify the visitor
    event = await get_event_by_id(event_id)
    event_title = event["title"] if event else "an event"
    await create_notification(
        user_id=user_id,
        type=NotificationType.PAYMENT_CONFIRMED,
        message=f"Your payment for '{event_title}' has been approved. You can now enter the event!",
    )

    return {"status": "approved", "message": "Payment approved and participant granted access."}


@router.patch("/admin/payments/{payment_id}/reject")
async def admin_reject_payment(
    payment_id: str,
    body: PaymentRejectRequest = PaymentRejectRequest(),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Reject a payment proof submission with an optional admin note.
    """
    payment = await get_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment["status"] == PaymentStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject an already-approved payment.",
        )

    # Update payment status
    await update_payment_status(
        payment_id, PaymentStatus.REJECTED, admin_note=body.admin_note
    )

    # Log audit
    await log_audit(
        actor_id=current_user["_id"],
        action="payment_rejected",
        entity="event_payment",
        entity_id=payment_id,
        metadata={
            "event_id": payment["event_id"],
            "user_id": payment["user_id"],
            "admin_note": body.admin_note,
        },
    )

    # Notify the visitor
    event = await get_event_by_id(payment["event_id"])
    event_title = event["title"] if event else "an event"
    note_suffix = f" Reason: {body.admin_note}" if body.admin_note else ""
    await create_notification(
        user_id=payment["user_id"],
        type=NotificationType.PAYMENT_REQUIRED,
        message=f"Your payment for '{event_title}' was rejected.{note_suffix} Please re-submit.",
    )

    return {"status": "rejected", "message": "Payment rejected."}


@router.get("/admin/payments/{payment_id}/proof")
async def admin_view_payment_proof(
    payment_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Get the payment proof file for admin review.

    Returns the uploaded proof file (image or PDF).
    """
    payment = await get_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    proof_path = payment.get("proof_file_path", "")
    if not proof_path:
        raise HTTPException(status_code=404, detail="No proof file associated with this payment.")

    # Build absolute path from relative path stored in DB
    # proof_file_path is like "uploads/payments/abc123.jpg"
    abs_path = os.path.join(os.getcwd(), proof_path)

    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="Proof file not found on server.")

    # Determine media type from extension
    ext = os.path.splitext(abs_path)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(abs_path, media_type=media_type)
