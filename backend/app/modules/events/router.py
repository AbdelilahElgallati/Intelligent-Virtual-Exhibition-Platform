"""
Events module router for IVEP.

Handles event request submission, admin review, payment confirmation, and lifecycle transitions.
"""

import os
import uuid
from typing import Optional
from zoneinfo import ZoneInfo
from urllib.parse import urlparse, parse_qs

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

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
    resolve_event_id,
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
from app.core.storage import store_upload



router = APIRouter(prefix="/events", tags=["Events"])

# States visible in public event catalogs by default.
PUBLIC_VISIBLE_EVENT_STATES = {
    EventState.APPROVED,
    EventState.PAYMENT_DONE,
    EventState.LIVE,
    EventState.CLOSED,
}

EVENT_BANNER_UPLOAD_DIR = "uploads/event_banners"
PAYMENT_PROOF_UPLOAD_DIR = "uploads/payments"
os.makedirs(EVENT_BANNER_UPLOAD_DIR, exist_ok=True)
os.makedirs(PAYMENT_PROOF_UPLOAD_DIR, exist_ok=True)


async def _save_upload(file: UploadFile, upload_dir: str, prefix: str) -> str:
    """Persist an uploaded file to R2 when configured, otherwise local uploads."""
    normalized_dir = upload_dir.replace("\\", "/")
    stored = await store_upload(
        file=file,
        local_dir=upload_dir,
        local_url_prefix=f"/{normalized_dir}",
        r2_folder=normalized_dir.replace("uploads/", "", 1),
        filename_prefix=prefix,
    )
    return stored["url"]


def _extract_legacy_invite_token(link: Optional[str]) -> Optional[str]:
    """Read token from legacy invite links that embed it in query params."""
    if not link:
        return None
    parsed = urlparse(link)
    return parse_qs(parsed.query).get("token", [None])[0]


def _is_valid_invite_token(event: dict, token: str, kind: str) -> bool:
    """Validate an invite token against explicit or legacy event fields."""
    field_name = f"{kind}_invite_token"
    stored = event.get(field_name)
    if stored and token == stored:
        return True

    # Backward compatibility for links that stored the token in the URL itself.
    legacy_link = event.get(f"{kind}_link")
    legacy_token = _extract_legacy_invite_token(legacy_link)
    return bool(legacy_token and token == legacy_token)


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
    event_id = await resolve_event_id(event_id)
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
    event_id = await resolve_event_id(event_id)
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = await get_user_participation(event_id, current_user["_id"])

    # ── Free event: instant access ──────────────────────────────────────
    if not event.get("is_paid"):
        if existing:
            return ParticipantRead(**existing)
        # Create participant and immediately approve
        true_event_id = str(event.get("_id") or event.get("id") or event_id)
        participant = await request_to_join(true_event_id, current_user["_id"])
        from app.modules.participants.service import approve_participant
        approved = await approve_participant(participant["_id"])
        return ParticipantRead(**approved)

    # ── Paid event: check payment status ────────────────────────────────
    true_event_id = str(event.get("_id") or event.get("id") or event_id)
    from app.modules.payments.service import get_user_payment
    payment = await get_user_payment(true_event_id, current_user["_id"])

    if payment and payment["status"] == "paid":
        # Payment completed via Stripe → ensure participant exists and is approved
        if existing:
            if existing["status"] in (ParticipantStatus.APPROVED.value, ParticipantStatus.GUEST_APPROVED.value):
                return ParticipantRead(**existing)
            from app.modules.participants.service import approve_participant
            approved = await approve_participant(existing["_id"])
            return ParticipantRead(**approved)
        participant = await request_to_join(true_event_id, current_user["_id"])
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


@router.post("/{event_id}/accept-visitor-invite", response_model=ParticipantRead)
async def accept_visitor_invite(
    event_id: str,
    token: Optional[str] = Query(None, min_length=8),
    current_user: dict = Depends(require_role(Role.VISITOR)),
):
    """Accept organizer visitor invite and grant guest-approved access without payment."""
    event_id = await resolve_event_id(event_id)
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    stored_token = event.get("visitor_invite_token")
    legacy_token = _extract_legacy_invite_token(event.get("visitor_link"))

    if token:
        if not _is_valid_invite_token(event, token, "visitor"):
            raise HTTPException(status_code=403, detail="Invalid or expired visitor invite token")
    elif stored_token or legacy_token:
        raise HTTPException(status_code=403, detail="Invite token is required for this event")

    true_event_id = str(event.get("_id") or event.get("id") or event_id)
    existing = await get_user_participation(true_event_id, current_user["_id"])
    from app.modules.participants.service import approve_participant

    if existing:
        if existing["status"] in (ParticipantStatus.APPROVED.value, ParticipantStatus.GUEST_APPROVED.value):
            return ParticipantRead(**existing)
        updated = await approve_participant(existing["_id"], ParticipantStatus.GUEST_APPROVED.value)
        return ParticipantRead(**updated)

    participant = await request_to_join(true_event_id, current_user["_id"])
    approved = await approve_participant(participant["_id"], ParticipantStatus.GUEST_APPROVED.value)
    return ParticipantRead(**approved)


# ============== Organizer Endpoints ==============

@router.post("/uploads/banner")
async def upload_event_banner(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    """Upload an event banner image and return a browser-accessible URL path."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Banner must be an image")

    banner_url = await _save_upload(file, EVENT_BANNER_UPLOAD_DIR, "event_banner")
    return {"banner_url": banner_url}

@router.get("/organizer/my-events", response_model=EventsResponse)
async def get_my_events_as_organizer(
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventsResponse:
    """Get all event requests submitted by the currently authenticated organizer."""
    events = await list_events(organizer_id=current_user["_id"])
    return EventsResponse(events=[EventRead(**e) for e in events], total=len(events))


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
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


@router.get("/admin/all", response_model=EventsResponse)
async def get_all_events_for_admin(
    organizer_id: Optional[str] = None,
    state: Optional[EventState] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventsResponse:
    """List all events for administrators without public visibility filtering."""
    events = await list_events(
        organizer_id=organizer_id,
        state=state,
        category=category,
        search=search,
    )
    return EventsResponse(events=[EventRead(**e) for e in events], total=len(events))


@router.get("", response_model=EventsResponse)
async def get_all_events(
    organizer_id: Optional[str] = None,
    state: Optional[EventState] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> EventsResponse:
    """List all events with optional filters. Public endpoint."""
    effective_state = state if state is not None else list(PUBLIC_VISIBLE_EVENT_STATES)
    events = await list_events(
        organizer_id=organizer_id, state=effective_state, category=category, search=search
    )
    return EventsResponse(events=[EventRead(**e) for e in events], total=len(events))


@router.get("/{event_id}", response_model=EventRead)
async def get_event(event_id: str) -> EventRead:
    """Get event by ID. Public endpoint."""
    event_id = await resolve_event_id(event_id)
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
    event_id = await resolve_event_id(event_id)
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

    event_id = await resolve_event_id(event_id)
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
            "status": {"$in": [ParticipantStatus.APPROVED.value, ParticipantStatus.GUEST_APPROVED.value]},
        })
        if not participant:
            raise HTTPException(status_code=400, detail="Enterprise is not an approved participant of this event")

        # Look up enterprise name
        ent_user = None
        if _OID.is_valid(data.assigned_enterprise_id):
            ent_user = await db.users.find_one({"_id": _OID(data.assigned_enterprise_id)})
        enterprise_name = (ent_user.get("full_name") or ent_user.get("email", "")) if ent_user else ""

        # Build conference start/end from event start_date + slot times in event timezone.
        event_date = event.get("start_date")
        if isinstance(event_date, str):
            event_date = _dt.fromisoformat(event_date)
        if event_date.tzinfo is None:
            event_date = event_date.replace(tzinfo=_tz.utc)
        # Use day offset
        from datetime import timedelta
        event_tz_name = str(event.get("event_timezone") or "UTC")
        try:
            event_tz = ZoneInfo(event_tz_name)
        except Exception:
            event_tz = _tz.utc
        event_local_start = event_date.astimezone(event_tz)
        day_offset = timedelta(days=data.day_index)
        base_local_date = event_local_start + day_offset

        sh, sm = (int(x) for x in slot["start_time"].split(":"))
        eh, em = (int(x) for x in slot["end_time"].split(":"))
        conf_start_local = base_local_date.replace(hour=sh, minute=sm, second=0, microsecond=0)
        conf_end_local = base_local_date.replace(hour=eh, minute=em, second=0, microsecond=0)
        conf_start = conf_start_local.astimezone(_tz.utc)
        conf_end = conf_end_local.astimezone(_tz.utc)
        if conf_end <= conf_start:
            conf_end = (conf_end_local + timedelta(days=1)).astimezone(_tz.utc)

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
    event_id = await resolve_event_id(event_id)
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
    event_id = await resolve_event_id(event_id)
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
    event_id = await resolve_event_id(event_id)
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
    event_id = await resolve_event_id(event_id)
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


@router.post("/{event_id}/upload-payment-proof", response_model=EventRead)
async def upload_and_submit_payment_proof(
    event_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Upload payment proof file and immediately submit it.
    Transition: WAITING_FOR_PAYMENT -> PAYMENT_PROOF_SUBMITTED
    """
    event_id = await resolve_event_id(event_id)
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    if event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    if event["state"] != EventState.WAITING_FOR_PAYMENT:
        raise HTTPException(status_code=400, detail="Must be in waiting_for_payment state")

    if not file.content_type or not (
        file.content_type.startswith("image/")
        or file.content_type == "application/pdf"
    ):
        raise HTTPException(status_code=400, detail="Payment proof must be an image or PDF")

    proof_url = await _save_upload(file, PAYMENT_PROOF_UPLOAD_DIR, f"event_{event_id}_proof")
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
    event_id = await resolve_event_id(event_id)
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
    event_id = await resolve_event_id(event_id)
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
    event_id = await resolve_event_id(event_id)
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


