"""
Events module router for IVEP.

Handles event request submission, admin review, payment confirmation, and lifecycle transitions.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user, require_feature, require_role, require_roles
from app.modules.auth.enums import Role
from app.modules.events.schemas import (
    EventApproveRequest,
    EventCreate,
    EventRead,
    EventRejectRequest,
    EventState,
    EventUpdate,
    EventsResponse,
)
from app.modules.events.service import (
    approve_event,
    confirm_event_payment,
    create_event,
    delete_event,
    get_event_by_id,
    get_joined_events,
    list_events,
    reject_event,
    update_event,
    update_event_state,
)
from app.modules.participants.service import get_user_participation, request_to_join
from app.modules.participants.schemas import ParticipantRead, ParticipantStatus
from app.modules.notifications.service import create_notification
from app.modules.notifications.schemas import NotificationType
from app.modules.audit.service import log_audit



router = APIRouter(prefix="/events", tags=["Events"])


# ============== Visitor / Public Endpoints ==============

@router.get("/joined", response_model=EventsResponse)
async def get_my_joined_events(
    current_user: dict = Depends(get_current_user),
) -> EventsResponse:
    """Get events where the current user is an APPROVED participant."""
    events = await get_joined_events(current_user["_id"])
    return EventsResponse(events=[EventRead(**e) for e in events], total=len(events))


@router.get("/{event_id}/my-status")
async def get_my_event_status(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get current user's participation status for an event."""
    participation = await get_user_participation(event_id, current_user["_id"])
    if participation:
        return {"status": participation["status"].upper(), "participant_id": participation.get("_id")}
    return {"status": "NOT_JOINED", "participant_id": None}


@router.post("/{event_id}/join")
async def join_event(
    event_id: str,
    current_user: dict = Depends(require_role(Role.VISITOR)),
):
    """Join or request to join an event.

    - Free events: instant APPROVED participant.
    - Paid events: gated by payment proof status.
    """
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = await get_user_participation(event_id, current_user["_id"])

    # ── Free event: instant access ──────────────────────────────────────
    if not event.get("is_paid"):
        if existing:
            return ParticipantRead(**existing)
        # Create participant and immediately approve
        participant = await request_to_join(event_id, current_user["_id"])
        from app.modules.participants.service import approve_participant
        approved = await approve_participant(participant["_id"])
        return ParticipantRead(**approved)

    # ── Paid event: check payment status ────────────────────────────────
    from app.modules.payments.service import get_user_payment
    payment = await get_user_payment(event_id, current_user["_id"])

    if payment and payment["status"] == "approved":
        # Payment approved → ensure participant exists and is approved
        if existing:
            if existing["status"] == ParticipantStatus.APPROVED:
                return ParticipantRead(**existing)
            from app.modules.participants.service import approve_participant
            approved = await approve_participant(existing["_id"])
            return ParticipantRead(**approved)
        participant = await request_to_join(event_id, current_user["_id"])
        from app.modules.participants.service import approve_participant
        approved = await approve_participant(participant["_id"])
        return ParticipantRead(**approved)

    # Payment missing, pending, or rejected → deny entry
    payment_status = payment["status"] if payment else "none"
    return {
        "requires_payment": True,
        "payment_status": payment_status,
        "ticket_price": event.get("ticket_price"),
    }


# ============== Organizer Endpoints ==============

@router.get("/organizer/my-events", response_model=EventsResponse)
async def get_my_events_as_organizer(
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventsResponse:
    """Get all event requests submitted by the currently authenticated organizer."""
    events = await list_events(organizer_id=current_user["_id"])
    return EventsResponse(events=[EventRead(**e) for e in events], total=len(events))


@router.post("/", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def submit_event_request(
    data: EventCreate,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Submit a new event request for admin review.

    The event is created directly in PENDING_APPROVAL state — no DRAFT step.
    Requires ORGANIZER role.
    """
    event = await create_event(data, current_user["_id"])
    return EventRead(**event)


@router.get("/", response_model=EventsResponse)
async def get_all_events(
    organizer_id: Optional[str] = None,
    state: Optional[EventState] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> EventsResponse:
    """List all events with optional filters. Public endpoint."""
    events = await list_events(
        organizer_id=organizer_id, state=state, category=category, search=search
    )
    return EventsResponse(events=[EventRead(**e) for e in events], total=len(events))


@router.get("/{event_id}", response_model=EventRead)
async def get_event(event_id: str) -> EventRead:
    """Get event by ID. Public endpoint."""
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    # Only expose payment_details when the event is paid
    if not event.get("is_paid"):
        event["payment_details"] = None
    return EventRead(**event)


@router.patch("/{event_id}", response_model=EventRead)
async def update_existing_event(
    event_id: str,
    data: EventUpdate,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Update a pending event request.

    Only allowed when state is PENDING_APPROVAL.
    Requires ORGANIZER role and ownership.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this event")

    if event["state"] != EventState.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event can only be edited while in PENDING_APPROVAL state.",
        )

    updated_event = await update_event(event_id, data)
    return EventRead(**updated_event)


@router.patch("/{event_id}/payment-details", response_model=EventRead)
async def update_event_payment_details(
    event_id: str,
    body: dict,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Update organizer bank / payment details for a paid event.

    Allowed in ANY event state (so organizer can configure bank info
    even after the event is approved or live).
    Requires ORGANIZER role and ownership.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Persist only the payment_details sub-document
    from app.db.mongo import get_database
    db = get_database()
    await db["events"].update_one(
        {"_id": __import__("bson").ObjectId(event_id) if __import__("bson").ObjectId.is_valid(event_id) else event_id},
        {"$set": {"payment_details": body}},
    )

    updated = await get_event_by_id(event_id)
    return EventRead(**updated)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_event(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    """
    Delete a pending event request.

    Only allowed when state is PENDING_APPROVAL or REJECTED.
    Requires ORGANIZER role and ownership.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this event")

    if event["state"] not in (EventState.PENDING_APPROVAL, EventState.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PENDING_APPROVAL or REJECTED events can be deleted.",
        )

    deleted = await delete_event(event_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete event")


# ============== Admin Review Endpoints ==============

@router.post("/{event_id}/approve", response_model=EventRead)
async def approve_event_request(
    event_id: str,
    body: EventApproveRequest = EventApproveRequest(),
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Approve an event request.

    Transition: PENDING_APPROVAL → WAITING_FOR_PAYMENT
    Calculates payment amount (enterprises × days × rate) unless overridden.
    Admin only.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["state"] != EventState.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve event. Current state: {event['state']}. Required: pending_approval",
        )

    updated_event = await approve_event(event_id, payment_amount=body.payment_amount)

    # Notify organizer
    await create_notification(
        user_id=event["organizer_id"],
        type=NotificationType.PAYMENT_REQUIRED,
        message=(
            f"Your event '{event['title']}' has been approved! "
            f"Please complete the payment of ${updated_event['payment_amount']:.2f} to activate it."
        ),
    )

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event.approve",
        entity="event",
        entity_id=event_id,
        metadata={"title": event["title"], "payment_amount": updated_event.get("payment_amount")},
    )

    return EventRead(**updated_event)


@router.post("/{event_id}/reject", response_model=EventRead)
async def reject_event_request(
    event_id: str,
    body: EventRejectRequest = EventRejectRequest(),
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Reject an event request.

    Transition: PENDING_APPROVAL → REJECTED
    Admin only.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["state"] != EventState.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject event. Current state: {event['state']}. Required: pending_approval",
        )

    updated_event = await reject_event(event_id, reason=body.reason)

    # Notify organizer
    reason_msg = f" Reason: {body.reason}" if body.reason else ""
    await create_notification(
        user_id=event["organizer_id"],
        type=NotificationType.EVENT_REJECTED,
        message=f"Your event request '{event['title']}' has been rejected.{reason_msg}",
    )

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event.reject",
        entity="event",
        entity_id=event_id,
        metadata={"title": event["title"], "reason": body.reason},
    )

    return EventRead(**updated_event)


# ============== Payment Endpoint ==============

@router.post("/{event_id}/confirm-payment", response_model=EventRead)
async def confirm_payment(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Confirm payment for an approved event.

    Transition: WAITING_FOR_PAYMENT → PAYMENT_DONE
    Generates enterprise and visitor access links.
    Requires ORGANIZER role and ownership.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if event["state"] != EventState.WAITING_FOR_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm payment. Current state: {event['state']}. Required: waiting_for_payment",
        )

    updated_event = await confirm_event_payment(event_id)

    # Notify organizer
    await create_notification(
        user_id=event["organizer_id"],
        type=NotificationType.LINKS_GENERATED,
        message=(
            f"Payment confirmed for '{event['title']}'! "
            "Your enterprise and visitor access links are now available."
        ),
    )

    return EventRead(**updated_event)


# ============== Lifecycle Transition Endpoints ==============

@router.post("/{event_id}/start", response_model=EventRead)
async def start_event(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Start event (go live).

    Transition: PAYMENT_DONE → LIVE
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only start your own events")

    if event["state"] != EventState.PAYMENT_DONE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start event. Current state: {event['state']}. Required: payment_done",
        )

    updated_event = await update_event_state(event_id, EventState.LIVE)
    return EventRead(**updated_event)


@router.post("/{event_id}/close", response_model=EventRead)
async def close_event(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Close event.

    Transition: LIVE → CLOSED
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only close your own events")

    if event["state"] != EventState.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot close event. Current state: {event['state']}. Required: live",
        )

    updated_event = await update_event_state(event_id, EventState.CLOSED)
    return EventRead(**updated_event)

