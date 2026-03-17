from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime
from typing import List, Optional
from .schemas import MeetingCreate, MeetingUpdate, MeetingSchema, MeetingJoinResponse, BusySlot
from .repository import meeting_repo
from ...core.dependencies import get_current_user
from ...core.config import settings
from ..stands.service import get_stand_by_id
from ..organizations.service import get_organization_by_id
from ..events.service import get_event_by_id
from ..livekit import service as lk
from ..analytics.service import log_event_persistent
from ..analytics.schemas import AnalyticsEventType

router = APIRouter()


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

    # Fetch my busy meeting slots
    my_slots = await meeting_repo.get_busy_slots(
        event_id,
        uid,
        my_stand_id,
        statuses=["pending", "approved"],
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
                participant_ids.append(str(partner_uid))
                partner_slots = await meeting_repo.get_busy_slots(
                    event_id,
                    str(partner_uid),
                    partner_stand_id,
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


@router.post("/", response_model=MeetingSchema, status_code=status.HTTP_201_CREATED)
async def request_meeting(
    meeting: MeetingCreate,
    current_user: dict = Depends(get_current_user)
):
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
    meeting_start = meeting.start_time.replace(tzinfo=None)
    meeting_end = meeting.end_time.replace(tzinfo=None)
    event_start = event["start_date"].replace(tzinfo=None) if isinstance(event["start_date"], datetime) else datetime.fromisoformat(event["start_date"].replace("Z", "+00:00")).replace(tzinfo=None)
    event_end = event["end_date"].replace(tzinfo=None) if isinstance(event["end_date"], datetime) else datetime.fromisoformat(event["end_date"].replace("Z", "+00:00")).replace(tzinfo=None)

    if meeting_start < event_start or meeting_end > event_end:
        raise HTTPException(
            status_code=400, 
            detail=f"Meeting must be within event dates: {event['start_date']} to {event['end_date']}"
        )

    # 2. Participant Approval Validation (Requester)
    from ..participants.service import get_user_participation
    part = await get_user_participation(meeting.event_id, user_id=str(current_user["_id"]))
    if not part or part.get("status") != "approved":
        raise HTTPException(status_code=403, detail="You must be an approved participant of this event to request meetings")

    # 3. Participant Approval Validation (Target Stand)
    stand = await get_stand_by_id(meeting.stand_id)
    if not stand:
        raise HTTPException(status_code=404, detail="Target stand not found")
    
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
        raise HTTPException(status_code=409, detail=conflict)

    # 5. Conference Conflict Detection for requester or target enterprise host
    db = meeting_repo.db
    target_org = await get_organization_by_id(stand["organization_id"])
    conference_participants = [str(current_user["_id"])]
    if target_org and target_org.get("owner_id"):
        conference_participants.append(str(target_org["owner_id"]))

    conf_conflict = await db.conferences.find_one({
        "event_id": meeting.event_id,
        "assigned_enterprise_id": {"$in": conference_participants},
        "status": {"$in": ["scheduled", "live"]},
        "start_time": {"$lt": meeting_end},
        "end_time": {"$gt": meeting_start},
    })
    if conf_conflict:
        raise HTTPException(
            status_code=409,
            detail=f"This time overlaps with conference \"{conf_conflict.get('title', 'Untitled')}\""
        )

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

    return created_meeting


@router.get("/my-meetings", response_model=List[MeetingSchema])
async def get_my_meetings(current_user: dict = Depends(get_current_user)):
    return await meeting_repo.get_visitor_meetings(str(current_user["_id"]))


@router.get("/stand/{stand_id}", response_model=List[MeetingSchema])
async def get_stand_meetings(
    stand_id: str,
    current_user: dict = Depends(get_current_user)
):
    await verify_stand_ownership(stand_id, str(current_user["_id"]))
    return await meeting_repo.get_stand_meetings(stand_id)


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
                if org and org.get("owner_id") == uid:
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

    room_name = meeting.get("livekit_room_name") or f"meeting-{meeting_id}"
    user_name = current_user.get("full_name") or current_user.get("email", uid)

    token = lk.generate_meeting_token(room_name, uid, user_name)

    return MeetingJoinResponse(
        token=token,
        livekit_url=settings.LIVEKIT_WS_URL,
        room_name=room_name,
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

    uid = str(current_user["_id"])
    is_requester = uid == meeting.get("visitor_id") or uid == meeting.get("initiator_id")
    is_owner = False
    stand_id = meeting.get("stand_id")
    if stand_id:
        try:
            stand = await get_stand_by_id(stand_id)
            if stand:
                org = await get_organization_by_id(stand["organization_id"])
                if org and org.get("owner_id") == uid:
                    is_owner = True
        except Exception:
            pass

    if not is_requester and not is_owner:
        raise HTTPException(status_code=403, detail="Not a participant")

    room_name = meeting.get("livekit_room_name") or f"meeting-{meeting_id}"
    # Best-effort room creation (LiveKit may not be running in dev)
    await lk.create_room(room_name)

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
                if org and org.get("owner_id") == uid:
                    is_owner = True
        except Exception:
            pass

    if not is_requester and not is_owner:
        raise HTTPException(status_code=403, detail="Not a participant")

    room_name = meeting.get("livekit_room_name") or f"meeting-{meeting_id}"
    await lk.delete_room(room_name)

    updated = await meeting_repo.end_session(meeting_id)
    return {"session_status": "ended"}


@router.patch("/{meeting_id}", response_model=MeetingSchema)
async def update_meeting(
    meeting_id: str,
    update: MeetingUpdate,
    current_user: dict = Depends(get_current_user)
):
    updated = await meeting_repo.update_meeting_status(meeting_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return updated
