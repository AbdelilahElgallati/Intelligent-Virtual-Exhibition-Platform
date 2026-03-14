"""
Events module router for IVEP.

Handles event request submission, admin review, payment confirmation, and lifecycle transitions.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

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
    ScheduleSlotConferenceAssign,
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

    if payment and payment["status"] == "paid":
        # Payment completed via Stripe → ensure participant exists and is approved
        if existing:
            if existing["status"] == ParticipantStatus.APPROVED.value:
                return ParticipantRead(**existing)
            from app.modules.participants.service import approve_participant
            approved = await approve_participant(existing["_id"])
            return ParticipantRead(**approved)
        participant = await request_to_join(event_id, current_user["_id"])
        from app.modules.participants.service import approve_participant
        approved = await approve_participant(participant["_id"])
        return ParticipantRead(**approved)

    # Payment missing or pending → tell frontend to redirect to payment
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
    # Auto-populate organizer_name from the user's profile
    if not data.organizer_name:
        data.organizer_name = current_user.get("full_name")
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


@router.patch("/{event_id}/schedule/assign-conference")
async def assign_conference_to_slot(
    event_id: str,
    data: ScheduleSlotConferenceAssign,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    """
    Assign or unassign a conference on a schedule slot.

    Works in PAYMENT_DONE or LIVE states. Creates/removes conference records automatically.
    """
    from bson import ObjectId as _OID
    from datetime import datetime as _dt, timezone as _tz
    from app.db.mongo import get_database

    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your event")
    if event["state"] not in (EventState.PAYMENT_DONE, EventState.LIVE):
        raise HTTPException(status_code=400, detail="Schedule can only be updated when event is in payment_done or live state")

    days = event.get("schedule_days")
    if not days or data.day_index >= len(days):
        raise HTTPException(status_code=400, detail="Invalid day_index")
    day = days[data.day_index]
    slots = day.get("slots", [])
    if data.slot_index >= len(slots):
        raise HTTPException(status_code=400, detail="Invalid slot_index")

    slot = slots[data.slot_index]
    db = get_database()

    if data.is_conference:
        # Validate enterprise exists and is approved for this event
        if not data.assigned_enterprise_id:
            raise HTTPException(status_code=400, detail="assigned_enterprise_id is required for conference slots")

        participant = await db.participants.find_one({
            "event_id": event_id,
            "user_id": data.assigned_enterprise_id,
            "status": ParticipantStatus.APPROVED.value,
        })
        if not participant:
            raise HTTPException(status_code=400, detail="Enterprise is not an approved participant of this event")

        # Look up enterprise name
        ent_user = None
        if _OID.is_valid(data.assigned_enterprise_id):
            ent_user = await db.users.find_one({"_id": _OID(data.assigned_enterprise_id)})
        enterprise_name = (ent_user.get("full_name") or ent_user.get("email", "")) if ent_user else ""

        # Build conference start/end from event start_date + slot times
        event_date = event.get("start_date")
        if isinstance(event_date, str):
            event_date = _dt.fromisoformat(event_date)
        # Use day offset
        from datetime import timedelta
        day_offset = timedelta(days=data.day_index)
        base_date = event_date + day_offset

        sh, sm = (int(x) for x in slot["start_time"].split(":"))
        eh, em = (int(x) for x in slot["end_time"].split(":"))
        conf_start = base_date.replace(hour=sh, minute=sm, second=0, microsecond=0)
        conf_end = base_date.replace(hour=eh, minute=em, second=0, microsecond=0)

        conf_title = data.title or slot.get("label") or "Conference"

        # Create or update conference
        old_conf_id = slot.get("conference_id")
        if old_conf_id and _OID.is_valid(old_conf_id):
            # Update existing conference
            await db.conferences.update_one(
                {"_id": _OID(old_conf_id)},
                {"$set": {
                    "title": conf_title,
                    "assigned_enterprise_id": data.assigned_enterprise_id,
                    "speaker_name": data.speaker_name or enterprise_name,
                    "start_time": conf_start,
                    "end_time": conf_end,
                    "updated_at": _dt.now(_tz.utc),
                }},
            )
            conf_id_str = old_conf_id
        else:
            # Create new conference
            conf_doc = {
                "title": conf_title,
                "description": "",
                "speaker_name": data.speaker_name or enterprise_name,
                "assigned_enterprise_id": data.assigned_enterprise_id,
                "organizer_id": str(current_user["_id"]),
                "event_id": event_id,
                "start_time": conf_start,
                "end_time": conf_end,
                "status": "scheduled",
                "livekit_room_name": None,
                "max_attendees": 0,
                "attendee_count": 0,
                "chat_enabled": True,
                "qa_enabled": True,
                "created_at": _dt.now(_tz.utc),
                "updated_at": _dt.now(_tz.utc),
            }
            result = await db.conferences.insert_one(conf_doc)
            conf_id_str = str(result.inserted_id)

            # Notify enterprise
            try:
                await create_notification(
                    user_id=data.assigned_enterprise_id,
                    type=NotificationType.CONFERENCE_ASSIGNED,
                    message=f'You have been assigned to host: "{conf_title}"',
                )
            except Exception:
                pass

        # Update slot in schedule_days
        slot["is_conference"] = True
        slot["assigned_enterprise_id"] = data.assigned_enterprise_id
        slot["assigned_enterprise_name"] = enterprise_name
        slot["speaker_name"] = data.speaker_name or enterprise_name
        slot["conference_id"] = conf_id_str
    else:
        # Remove conference assignment
        old_conf_id = slot.get("conference_id")
        if old_conf_id and _OID.is_valid(old_conf_id):
            await db.conferences.update_one(
                {"_id": _OID(old_conf_id)},
                {"$set": {"status": "canceled", "updated_at": _dt.now(_tz.utc)}},
            )
        slot["is_conference"] = False
        slot["assigned_enterprise_id"] = None
        slot["assigned_enterprise_name"] = None
        slot["speaker_name"] = None
        slot["conference_id"] = None

    # Persist updated schedule_days
    from app.modules.events.service import get_events_collection
    collection = get_events_collection()
    await collection.update_one(
        {"_id": _OID(event_id) if _OID.is_valid(event_id) else event_id},
        {"$set": {"schedule_days": days}},
    )

    return {"detail": "Schedule slot updated", "slot": slot}


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

@router.post("/{event_id}/submit-proof", response_model=EventRead)
async def submit_proof(
    event_id: str,
    proof_url: str = Query(..., description="URL or file path to payment proof"),
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Submit payment proof for an approved event.
    Transition: WAITING_FOR_PAYMENT → PAYMENT_PROOF_SUBMITTED
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if event["state"] != EventState.WAITING_FOR_PAYMENT:
        raise HTTPException(status_code=400, detail="Must be in waiting_for_payment state")

    from app.modules.events.service import submit_payment_proof
    updated_event = await submit_payment_proof(event_id, proof_url)
    
    return EventRead(**updated_event)


# ============== Admin Payment Confirmation ==============

@router.post("/{event_id}/confirm-payment", response_model=EventRead)
async def confirm_payment(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Confirm payment for an event (Admin only).
    Transition: PAYMENT_PROOF_SUBMITTED → PAYMENT_DONE
    Generates enterprise and visitor access links.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["state"] != EventState.PAYMENT_PROOF_SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm payment. Current state: {event['state']}. Required: payment_proof_submitted",
        )

    updated_event = await confirm_event_payment(event_id)

    # Notify organizer
    await create_notification(
        user_id=event["organizer_id"],
        type=NotificationType.LINKS_GENERATED,
        message=(
            f"Payment confirmed for '{event['title']}'! "
            "Your event is now activated and links are available."
        ),
    )

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event.payment_confirmed",
        entity="event",
        entity_id=event_id,
        metadata={"title": event["title"], "payment_amount": event.get("payment_amount")}
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

