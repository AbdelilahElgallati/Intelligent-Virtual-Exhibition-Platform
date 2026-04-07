def stringify_object_ids(doc):
    """Convert all ObjectId fields in a dict to strings (recursive for lists)."""
    if isinstance(doc, list):
        return [stringify_object_ids(d) for d in doc]
    if isinstance(doc, dict):
        return {k: str(v) if k == "_id" and hasattr(v, "__str__") else stringify_object_ids(v) for k, v in doc.items()}
    return doc

from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timedelta, timezone
import json
import time
from typing import List, Optional
from zoneinfo import ZoneInfo
from .schemas import MeetingCreate, MeetingUpdate, MeetingSchema, MeetingJoinResponse, BusySlot
from .repository import meeting_repo
from ...core.dependencies import get_current_user
from ...core.config import settings
from ..stands.service import get_stand_by_id
from ..organizations.service import get_organization_by_id
from ..events.service import get_event_by_id, resolve_event_id
from ...db.mongo import get_database
from bson import ObjectId
from ..daily import service as daily_svc
from ...core.timezone import timezone_service
from ..analytics.service import log_event_persistent
from ..analytics.schemas import AnalyticsEventType
from ..notifications.service import create_notification
from ..notifications.schemas import NotificationType
from bson import ObjectId

from app.modules.stands.service import (
    create_stand, 
    get_stand_by_org, 
    list_event_stands, 
    update_stand,
    resolve_stand_id
)

router = APIRouter()


def _to_utc_datetime(value) -> Optional[datetime]:
    return timezone_service.to_aware_utc(value)


def _ensure_meeting_within_scheduled_window(meeting: dict):
    """
    Block Daily.co token issuance before the meeting's scheduled start (UTC).
    End-of-slot cleanup and 410 responses are handled by _ensure_meeting_not_expired.
    """
    start_time = _to_utc_datetime(meeting.get("start_time"))
    now_utc = timezone_service.get_now_utc()

    if start_time and now_utc < start_time:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This meeting has not started yet. You can join during the scheduled time window.",
        )


async def _ensure_meeting_not_expired(meeting_id: str, meeting: dict):
    end_time = _to_utc_datetime(meeting.get("end_time"))
    if not end_time:
        return

    now_utc = timezone_service.get_now_utc()
    if now_utc < end_time:
        return

    # Auto-close expired sessions to keep lifecycle consistent.
    if meeting.get("session_status") != "ended" or meeting.get("status") != "completed":
        # Support both old "livekit_room_name" and new "room_name" field
        room_name = (
            meeting.get("room_name")
            or meeting.get("livekit_room_name")
            or f"meeting-{meeting_id}"
        )
        await daily_svc.delete_room(room_name)
        await meeting_repo.end_session(meeting_id)

    raise HTTPException(status_code=410, detail="Meeting timeslot has ended")


def _parse_hhmm_to_minutes(value: Optional[str]) -> Optional[int]:
    if not value or ":" not in value:
        return None
    try:
        h_str, m_str = str(value).split(":", 1)
        h = int(h_str)
        m = int(m_str)
        if h < 0 or h > 23 or m < 0 or m > 59:
            return None
        return h * 60 + m
    except Exception:
        return None


def _extract_schedule_days(event: dict) -> list[dict]:
    days = event.get("schedule_days")
    if isinstance(days, list) and days:
        return days

    timeline = event.get("event_timeline")
    if isinstance(timeline, str) and timeline.strip():
        try:
            parsed = json.loads(timeline)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            return []
    return []


def _is_event_live_by_timeline(event: dict, now_utc: datetime) -> bool:
    return timezone_service.is_event_live(event, now_utc)


async def _ensure_event_timeline_live(meeting: dict):
    event_id = meeting.get("event_id")
    if not event_id:
        return

    event = await get_event_by_id(str(event_id))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    now_utc = timezone_service.get_now_utc()
    if not _is_event_live_by_timeline(event, now_utc):
        raise HTTPException(
            status_code=403,
            detail="Meeting access is allowed only during live event schedule slots",
        )


async def verify_stand_ownership(stand_id: str, user_id: str):
    stand = await get_stand_by_id(stand_id)
    if not stand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")

    org = await get_organization_by_id(stand["organization_id"])
    if not org or org["owner_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access meetings for this stand"
        )
    return stand


@router.get("/busy-slots", response_model=List[BusySlot])
async def get_busy_slots(
    event_id: str = Query(...),
    partner_stand_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns all busy time slots for the current user AND the partner stand
    within the given event. Includes meetings (pending/approved) and
    conferences (scheduled/live).
    """
    event_id = await resolve_event_id(event_id)
    uid = str(current_user["_id"])
    db = meeting_repo.db

    # Find user's own stand in this event (if any)
    my_stand_id = None
    org_member = await db.organization_members.find_one({"user_id": uid})
    if org_member:
        org_id = str(org_member["organization_id"])
        my_stand = await db.stands.find_one({"event_id": event_id, "organization_id": org_id})
        if my_stand:
            my_stand_id = str(my_stand["_id"])

    # Fetch my busy meeting slots.
    # For the "stand" side (inbound meetings from others on MY stand) we only count
    # APPROVED meetings — a visitor's pending request that hasn't been accepted yet
    # should not block the enterprise owner from making outgoing requests at that time.
    my_slots = await meeting_repo.get_busy_slots(
        event_id,
        uid,
        my_stand_id,
        statuses=["pending", "approved"],   # my OWN outgoing requests: pending counts
        stand_statuses=["approved"],         # inbound on my stand: only approved counts
    )

    # Fetch partner's busy meeting slots
    partner_slots: list[dict] = []
    participant_ids = [uid]
    if partner_stand_id:
        partner_stand = await get_stand_by_id(partner_stand_id)
        if partner_stand:
            org = await get_organization_by_id(partner_stand["organization_id"])
            partner_uid = org.get("owner_id") if org else None
            if partner_uid:
                partner_uid = str(partner_uid)
                # Ensure partner_stand_id is the internal _id (in case a slug was passed)
                internal_stand_id = str(partner_stand["_id"])
                participant_ids.append(partner_uid)
                partner_slots = await meeting_repo.get_busy_slots(
                    event_id,
                    partner_uid,
                    internal_stand_id,
                    statuses=["approved"],
                )

    # Fetch hosted conference busy slots only for the two meeting participants
    conf_cursor = db.conferences.find({
        "event_id": event_id,
        "assigned_enterprise_id": {"$in": participant_ids},
        "status": {"$in": ["scheduled", "live"]},
    })
    conf_docs = await conf_cursor.to_list(length=200)
    conf_slots = []
    for c in conf_docs:
        conf_slots.append({
            "start_time": c["start_time"],
            "end_time": c["end_time"],
            "type": "conference",
            "label": c.get("title") or "Conference",
        })

    # Merge all
    all_slots = my_slots + partner_slots + conf_slots
    return all_slots


@router.post("", response_model=MeetingSchema, status_code=status.HTTP_201_CREATED)
async def request_meeting(
    meeting: MeetingCreate,
    current_user: dict = Depends(get_current_user)
):
    # Auto-fill "SELF" so the frontend can request B2B meetings without
    # having to know its own Mongo _id on the client side.
    # Resolve event_id if it's a slug
    resolved_event_id = await resolve_event_id(meeting.event_id)
    
    # Resolve stand_id if it's a slug and get internal _id
    stand = await get_stand_by_id(meeting.stand_id)
    if not stand:
        raise HTTPException(status_code=404, detail="Target stand not found")
    internal_stand_id = str(stand["_id"])

    # Update meeting model with resolved internal IDs for database storage
    meeting = meeting.model_copy(update={
        "event_id": resolved_event_id,
        "stand_id": internal_stand_id
    })

    # Auto-fill "SELF" so the frontend can request B2B meetings without
    # having to know its own Mongo _id on the client side.
    if meeting.visitor_id == "SELF":
        meeting = meeting.model_copy(update={"visitor_id": str(current_user["_id"])})

    # Auto-fill initiator
    if not meeting.initiator_id:
        meeting = meeting.model_copy(update={"initiator_id": str(current_user["_id"])})

    # Ensure requester matches current user
    if meeting.visitor_id != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Cannot request meeting for another visitor")

    # ── VALIDATION: Event & Participation ────────────────────────────────────
    if not meeting.event_id:
        raise HTTPException(status_code=400, detail="event_id is required for new meetings")
    
    event = await get_event_by_id(meeting.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # 1. Date Validation
    meeting_start = timezone_service.to_aware_utc(meeting.start_time)
    meeting_end = timezone_service.to_aware_utc(meeting.end_time)
    now_utc = timezone_service.get_now_utc()

    if meeting_start and meeting_start < now_utc:
        raise HTTPException(status_code=400, detail="Meeting start time must be in the future")

    event_start = timezone_service.to_aware_utc(event.get("start_date"))
    event_end = timezone_service.to_aware_utc(event.get("end_date"))
    # Normalize event_end for single-day events ending at midnight (fixes midnight boundary bug)
    if event_start and event_end and event_start.date() == event_end.date() and event_end.time() == datetime.min.time():
        event_end = event_end + timedelta(days=1)

    if meeting_start and event_start and meeting_end and event_end:
        if meeting_start < event_start or meeting_end > event_end:
            raise HTTPException(
                status_code=400, 
                detail=f"Meeting must be within event dates: {event_start.isoformat()} to {event_end.isoformat()}"
            )

    # 2. Participant Approval Validation (Requester)
    from ..participants.service import get_user_participation
    part = await get_user_participation(meeting.event_id, user_id=str(current_user["_id"]))
    if not part or part.get("status") != "approved":
        raise HTTPException(status_code=403, detail="You must be an approved participant of this event to request meetings")

    # 3. Participant Approval Validation (Target Stand)
    # stand already resolved above
    target_part = await get_user_participation(meeting.event_id, organization_id=str(stand["organization_id"]))
    if not target_part or target_part.get("status") != "approved":
        raise HTTPException(status_code=403, detail="The target enterprise is not an approved participant for this event")

    # 4. Conflict Detection (overlapping meetings)
    conflict = await meeting_repo.check_conflict(
        event_id=meeting.event_id,
        user_id=str(current_user["_id"]),
        stand_id=meeting.stand_id,
        start_time=meeting_start,
        end_time=meeting_end,
    )
    if conflict:
        # Only block if the conflict is with another meeting, not a conference
        if conflict.get("type") == "meeting":
            raise HTTPException(status_code=409, detail=conflict)
        # If conflict is with a conference, just warn and allow
        import warnings
        warnings.warn(f"This time overlaps with conference '{conflict.get('label', 'Untitled')}'", UserWarning)

    # 5. Conference Conflict Detection for requester or target enterprise host
    db = meeting_repo.db
    target_org = await get_organization_by_id(stand["organization_id"])
    conference_participants = [str(current_user["_id"])]
    if target_org and target_org.get("owner_id"):
        owner_id = str(target_org["owner_id"])
        if owner_id not in conference_participants:
            conference_participants.append(owner_id)

    conf_conflict = await db.conferences.find_one({
        "event_id": meeting.event_id,
        "assigned_enterprise_id": {"$in": conference_participants},
        "status": {"$in": ["scheduled", "live"]},
        "start_time": {"$lt": meeting_end},
        "end_time": {"$gt": meeting_start},
    })
    # Only block if the current user is a host/participant in the conference
    if conf_conflict:
        assigned_id = conf_conflict.get("assigned_enterprise_id")
        if assigned_id and assigned_id in conference_participants:
            # For B2B meetings, do not block, just warn (add a warning to response or log)
            import warnings
            warnings.warn(f"This time overlaps with conference '{conf_conflict.get('title', 'Untitled')}'", UserWarning)
            # Optionally, attach a warning to the created_meeting object or response
            # For now, just log and allow the meeting

    created_meeting = await meeting_repo.create_meeting(meeting)

    # Best-effort analytics instrumentation.
    try:
        await log_event_persistent(
            type=AnalyticsEventType.MEETING_BOOKED,
            user_id=str(current_user["_id"]),
            event_id=str(meeting.event_id),
            stand_id=str(meeting.stand_id),
            metadata={
                "meeting_id": created_meeting.get("_id"),
                "meeting_type": str(meeting.meeting_type),
                "status": created_meeting.get("status", "pending"),
            },
        )
    except Exception:
        pass

    # Notify the target enterprise owner
    try:
        target_org = await get_organization_by_id(stand["organization_id"])
        if target_org and target_org.get("owner_id"):
            await create_notification(
                user_id=target_org["owner_id"],
                type=NotificationType.MEETING_REQUEST,
                message=f"New meeting request from {current_user.get('full_name') or current_user.get('email')}"
            )
    except Exception as e:
        print(f"Failed to create meeting notification: {e}")

    return created_meeting


@router.get("/between-orgs", response_model=List[MeetingSchema])
async def get_meetings_between_orgs(
    event_id: str,
    org_id_1: str,
    org_id_2: str,
    current_user=Depends(get_current_user)
):
    """Returns all meetings in an event where both orgs are involved (as stand owner or visitor)."""
    db = meeting_repo.db
    resolved_event_id = await resolve_event_id(event_id)
    print(f"[between-orgs] event_id={event_id} resolved={resolved_event_id} org1={org_id_1} org2={org_id_2}")

    # Get stands for both orgs in this event
    org1_stands = await db.stands.find({
        "event_id": resolved_event_id,
        "organization_id": org_id_1
    }).to_list(length=None)
    org2_stands = await db.stands.find({
        "event_id": resolved_event_id,
        "organization_id": org_id_2
    }).to_list(length=None)

    org1_stand_ids = [str(s["_id"]) for s in org1_stands]
    org2_stand_ids = [str(s["_id"]) for s in org2_stands]

    if not org1_stand_ids and not org2_stand_ids:
        return []

    # Get all User IDs belonging to both orgs to identify B2B participants.
    # We query organization_members using both string and ObjectId variants to handle mixed data types.
    org_variants_1 = [org_id_1]
    if ObjectId.is_valid(org_id_1):
        org_variants_1.append(ObjectId(org_id_1))
        
    org_variants_2 = [org_id_2]
    if ObjectId.is_valid(org_id_2):
        org_variants_2.append(ObjectId(org_id_2))

    org1_members = await db.organization_members.find({"organization_id": {"$in": org_variants_1}}).to_list(length=None)
    org2_members = await db.organization_members.find({"organization_id": {"$in": org_variants_2}}).to_list(length=None)
    
    org1_user_ids = [str(m["user_id"]) for m in org1_members]
    org2_user_ids = [str(m["user_id"]) for m in org2_members]

    # Find meetings specifically BETWEEN these two organizations (B2B):
    # - Stand belongs to Org 1 AND Visitor is a member of Org 2
    # - OR
    # - Stand belongs to Org 2 AND Visitor is a member of Org 1
    meetings = await db.meetings.find({
        "event_id": resolved_event_id,
        "$or": [
            {"stand_id": {"$in": org1_stand_ids}, "visitor_id": {"$in": org2_user_ids}},
            {"stand_id": {"$in": org2_stand_ids}, "visitor_id": {"$in": org1_user_ids}}
        ]
    }).to_list(length=None)

    print(f"[between-orgs] found {len(meetings)} meetings after B2B cross-filtering")

    org1_stand_ids_set = set(org1_stand_ids)

    result = []
    for m in meetings:
        m = stringify_object_ids(m)
        stand_id = str(m.get("stand_id", ""))
        # inbound = the meeting is AT org1's stand (org2 is visiting org1)
        # outbound = the meeting is AT org2's stand (org1 is visiting org2)
        m["type"] = "inbound" if stand_id in org1_stand_ids_set else "outbound"
        result.append(m)

    return result



from bson import ObjectId

@router.get("/my-meetings", response_model=List[MeetingSchema])
async def get_my_meetings(
    current_user: dict = Depends(get_current_user),
    event_id: Optional[str] = None
):
    """
    Returns all meetings for the current user. If event_id is provided, only meetings for that event are returned.
    """
    meetings = await meeting_repo.get_visitor_meetings(str(current_user["_id"]))
    if event_id:
        resolved_event_id = await resolve_event_id(event_id)
        # Filter by both string and ObjectId for legacy/compatibility
        event_variants = [resolved_event_id]
        if event_id != resolved_event_id:
            event_variants.append(event_id)
        meetings = [m for m in meetings if str(m.get("event_id")) in event_variants]
    return meetings



@router.get("/stand/{stand_id}", response_model=List[MeetingSchema])
async def get_stand_meetings(
    stand_id: str,
    current_user: dict = Depends(get_current_user),
    event_id: Optional[str] = None
):
    """
    Returns all meetings for a stand. If event_id is provided, only meetings for that event are returned.
    """
    stand = await get_stand_by_id(stand_id)
    if not stand:
        raise HTTPException(status_code=404, detail="Stand not found")
    internal_stand_id = str(stand["_id"])

    await verify_stand_ownership(internal_stand_id, str(current_user["_id"]))
    meetings = await meeting_repo.get_stand_meetings(internal_stand_id)
    if event_id:
        resolved_event_id = await resolve_event_id(event_id)
        event_variants = [resolved_event_id]
        if event_id != resolved_event_id:
            event_variants.append(event_id)
        meetings = [m for m in meetings if str(m.get("event_id")) in event_variants]
    return meetings


@router.get("/{meeting_id}/token", response_model=MeetingJoinResponse)
async def get_meeting_token(
    meeting_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a LiveKit access token for this meeting.
    Only the two participants (visitor_id or stand owner) can call this.
    Meeting must be approved.
    """
    meeting = await meeting_repo.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    _ensure_meeting_within_scheduled_window(meeting)
    await _ensure_meeting_not_expired(meeting_id, meeting)
    await _ensure_event_timeline_live(meeting)

    uid = str(current_user["_id"])

    # Check participant is either requester or stand owner
    is_requester = uid == meeting.get("visitor_id") or uid == meeting.get("initiator_id")

    # Check if stand owner
    is_owner = False
    stand_id = meeting.get("stand_id")
    if stand_id:
        try:
            stand = await get_stand_by_id(stand_id)
            if stand:
                org = await get_organization_by_id(stand["organization_id"])
                if org and str(org.get("owner_id")) == uid:
                    is_owner = True
        except Exception:
            pass

    if not is_requester and not is_owner:
        raise HTTPException(status_code=403, detail="You are not a participant in this meeting")

    if meeting.get("status") not in ("approved", "completed"):
        raise HTTPException(
            status_code=400,
            detail=f"Meeting is not approved yet (status: {meeting.get('status')})"
        )

    # Support both old "livekit_room_name" and new "room_name" field (MongoDB back-compat)
    room_name = (
        meeting.get("room_name")
        or meeting.get("livekit_room_name")
        or f"meeting-{meeting_id}"
    )
    user_name = current_user.get("full_name") or current_user.get("email", uid)

    # is_owner = True for the stand owner (enterprise side)
    start_time = _to_utc_datetime(meeting.get("start_time"))
    nbf = None
    if start_time:
        st_ts = int(start_time.timestamp())
        now_ts = int(time.time())
        # Use 60s grace period if in the future, otherwise use exact start_time
        nbf = st_ts - 60 if st_ts > now_ts else st_ts

    token = await daily_svc.generate_meeting_token(room_name, uid, user_name, is_owner=is_owner, nbf=nbf)

    return MeetingJoinResponse(
        token=token,
        room_url=daily_svc.get_room_url(room_name),
        room_name=room_name,
        ends_at=_to_utc_datetime(meeting.get("end_time")),
    )


@router.post("/{meeting_id}/start")
async def start_meeting_session(
    meeting_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark meeting as live and (attempt to) create a LiveKit room."""
    meeting = await meeting_repo.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    _ensure_meeting_within_scheduled_window(meeting)
    await _ensure_meeting_not_expired(meeting_id, meeting)
    await _ensure_event_timeline_live(meeting)

    uid = str(current_user["_id"])
    is_requester = uid == meeting.get("visitor_id") or uid == meeting.get("initiator_id")
    is_owner = False
    stand_id = meeting.get("stand_id")
    if stand_id:
        try:
            stand = await get_stand_by_id(stand_id)
            if stand:
                org = await get_organization_by_id(stand["organization_id"])
                if org and str(org.get("owner_id")) == uid:
                    is_owner = True
        except Exception:
            pass

    if not is_requester and not is_owner:
        raise HTTPException(status_code=403, detail="Not a participant")

    # Support both old "livekit_room_name" and new "room_name" field (MongoDB back-compat)
    room_name = (
        meeting.get("room_name")
        or meeting.get("livekit_room_name")
        or f"meeting-{meeting_id}"
    )
    # Best-effort room creation (no-op if credentials not set in dev)
    await daily_svc.create_room(room_name)

    updated = await meeting_repo.start_session(meeting_id)
    return {"session_status": "live", "room_name": room_name}


@router.post("/{meeting_id}/end")
async def end_meeting_session(
    meeting_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark meeting session as ended."""
    meeting = await meeting_repo.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    uid = str(current_user["_id"])
    is_requester = uid == meeting.get("visitor_id") or uid == meeting.get("initiator_id")
    is_owner = False
    stand_id = meeting.get("stand_id")
    if stand_id:
        try:
            stand = await get_stand_by_id(stand_id)
            if stand:
                org = await get_organization_by_id(stand["organization_id"])
                if org and str(org.get("owner_id")) == uid:
                    is_owner = True
        except Exception:
            pass

    if not is_requester and not is_owner:
        raise HTTPException(status_code=403, detail="Not a participant")

    # Support both old "livekit_room_name" and new "room_name" field (MongoDB back-compat)
    room_name = (
        meeting.get("room_name")
        or meeting.get("livekit_room_name")
        or f"meeting-{meeting_id}"
    )
    await daily_svc.delete_room(room_name)

    updated = await meeting_repo.end_session(meeting_id)
    return {"session_status": "ended"}


@router.patch(
    "/{meeting_id}",
    response_model=MeetingSchema,
    responses={404: {"description": "Meeting not found"}},
)
async def update_meeting(
    meeting_id: str,
    update: MeetingUpdate,
    current_user: dict = Depends(get_current_user)
):
    # Fetch meeting first to verify ownership before applying update
    meeting = await meeting_repo.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    user_id = str(current_user["_id"])
    raw_role = current_user.get("role", "")
    user_role = str(getattr(raw_role, "value", raw_role)).lower()

    # We need to resolve the stand owner/org info for authorization (all statuses) 
    # and notification (cancellation recipient)
    is_authorized = False
    stand_owner_id = None
    if update.status in ("approved", "rejected", "canceled"):
        stand_id = str(meeting.get("stand_id", ""))
        if ObjectId.is_valid(stand_id):
            stand = await get_database().stands.find_one({"_id": ObjectId(stand_id)})
            if stand:
                org_id = str(stand.get("organization_id", ""))
                if org_id:
                    org = await get_database().organizations.find_one(
                        {"_id": ObjectId(org_id)} if ObjectId.is_valid(org_id) else {"_id": org_id}
                    )
                    if org:
                        stand_owner_id = str(org.get("owner_id", ""))
                        if stand_owner_id == user_id:
                            is_authorized = True
                        
                        # Also allow org members (manager or owner role in organization_members)
                        if not is_authorized:
                            member = await get_database().organization_members.find_one({
                                "organization_id": org_id,
                                "user_id": user_id,
                                "role": {"$in": ["owner", "manager"]}
                            })
                            if member:
                                is_authorized = True

    # Only the stand owner (enterprise) or an admin can approve/reject
    if update.status in ("approved", "rejected"):
        if user_role != "admin" and not is_authorized:
            raise HTTPException(status_code=403, detail="Only the stand owner or org manager can approve or reject meetings")

    # BUG FIX 1: Allow both sender (visitor_id) and receiver (is_authorized) to cancel
    # Note: Original code used "cancelled" (2 l's) which was dead code (enum uses "canceled")
    if update.status == "canceled":
        if user_role != "admin" and str(meeting.get("visitor_id")) != user_id and not is_authorized:
            raise HTTPException(status_code=403, detail="Only the meeting participants can cancel this meeting")

    updated = await meeting_repo.update_meeting_status(meeting_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if updated:
        # BUG FIX 2 & 3: Notify the OTHER party and avoid self-notification
        try:
            target_user_id = None
            if update.status == "canceled":
                # If sender cancels -> notify receiver (stand owner)
                if user_id == str(updated["visitor_id"]):
                    target_user_id = stand_owner_id
                # If receiver cancels -> notify sender (visitor)
                else:
                    target_user_id = updated["visitor_id"]
            else:
                # For approved/rejected, notify the visitor (sender)
                target_user_id = updated["visitor_id"]

            if target_user_id and str(target_user_id) != user_id:
                msg = f"Meeting request was {update.status}"
                if update.notes:
                    msg += f": {update.notes}"
                await create_notification(
                    user_id=str(target_user_id),
                    type=NotificationType.MEETING_UPDATE,
                    message=msg
                )
        except Exception as e:
            print(f"Failed to create meeting update notification: {e}")
            
    return updated


