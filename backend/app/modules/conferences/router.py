"""
Conference router for IVEP.

Three role groups:
  - Organizer: create/assign/edit/cancel conferences within their events
  - Enterprise (assigned): go live, end session, get speaker token
  - All authenticated: browse, register, get audience token, Q&A
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional

from app.core.dependencies import get_current_user, require_role
from app.core.config import settings
from app.modules.auth.enums import Role
from app.modules.conferences.schemas import (
    ConferenceCreate, ConferenceUpdate, ConferenceRead,
    ConferenceTokenResponse, QACreate, QAAnswer, QARead,
)
from app.modules.conferences.repository import conf_repo
from app.modules.notifications.service import create_notification
from app.modules.notifications.schemas import NotificationType
from app.db.mongo import get_database
from app.modules.livekit import service as lk
from app.modules.analytics.service import log_event_persistent
from app.modules.analytics.schemas import AnalyticsEventType

router = APIRouter(tags=["conferences"])

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_conf_or_404(conf_id: str) -> dict:
    conf = await conf_repo.get_by_id(conf_id)
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")
    return conf


async def _assert_assigned_enterprise(conf: dict, current_user: dict):
    """Raises 403 if current user is not the assigned enterprise host."""
    if str(current_user["_id"]) != conf.get("assigned_enterprise_id"):
        raise HTTPException(
            status_code=403,
            detail="Only the assigned enterprise can perform this action"
        )


async def _enrich(conf: dict, current_user_id: Optional[str] = None) -> dict:
    """Attach enterprise display name and is_registered flag."""
    db = get_database()
    eid = conf.get("assigned_enterprise_id")
    if eid:
        user = await db.users.find_one({"_id": __import__("bson").ObjectId(eid)}) if __import__("bson").ObjectId.is_valid(eid) else None
        if user:
            conf["assigned_enterprise_name"] = user.get("full_name") or user.get("email")
    if current_user_id:
        conf["is_registered"] = await conf_repo.is_registered(conf["_id"], current_user_id)
    return conf


# ── Organizer Routes ──────────────────────────────────────────────────────────

@router.post(
    "/organizer/events/{event_id}/conferences",
    response_model=ConferenceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Organizer: create a conference slot and assign it to an enterprise",
)
async def organizer_create_conference(
    event_id: str,
    data: ConferenceCreate,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    doc = data.model_dump()
    doc["event_id"] = event_id
    doc["organizer_id"] = str(current_user["_id"])
    doc["status"] = "scheduled"
    doc["livekit_room_name"] = None   # assigned when going live

    conf = await conf_repo.create(doc)

    # Notify the assigned enterprise
    try:
        await create_notification(
            user_id=data.assigned_enterprise_id,
            type=NotificationType.CONFERENCE_ASSIGNED,
            message=f"You have been assigned to host a conference: \"{data.title}\" — {data.start_time.strftime('%Y-%m-%d %H:%M UTC')}",
        )
    except Exception:
        pass

    return conf


@router.get(
    "/organizer/events/{event_id}/conferences",
    response_model=List[ConferenceRead],
    summary="Organizer: list conferences for an event",
)
async def organizer_list_conferences(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    confs = await conf_repo.list_by_event(event_id)
    return [await _enrich(c) for c in confs]


@router.patch(
    "/organizer/events/{event_id}/conferences/{conf_id}",
    response_model=ConferenceRead,
    summary="Organizer: update conference details or reassign enterprise",
)
async def organizer_update_conference(
    event_id: str,
    conf_id: str,
    data: ConferenceUpdate,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    conf = await _get_conf_or_404(conf_id)
    if conf.get("organizer_id") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your event")

    fields = {k: v for k, v in data.model_dump().items() if v is not None}
    updated = await conf_repo.update(conf_id, fields)
    return await _enrich(updated)


@router.delete(
    "/organizer/events/{event_id}/conferences/{conf_id}",
    summary="Organizer: cancel a conference",
)
async def organizer_cancel_conference(
    event_id: str,
    conf_id: str,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    conf = await _get_conf_or_404(conf_id)
    if conf.get("organizer_id") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your event")
    await conf_repo.set_status(conf_id, "canceled")
    return {"detail": "Conference canceled"}


# ── Enterprise (Assigned Host) Routes ─────────────────────────────────────────

@router.get(
    "/conferences/my-assigned",
    response_model=List[ConferenceRead],
    summary="Enterprise: list conferences assigned to me",
)
async def enterprise_my_conferences(
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    confs = await conf_repo.list_by_enterprise(str(current_user["_id"]))
    return [await _enrich(c, str(current_user["_id"])) for c in confs]


@router.post(
    "/conferences/{conf_id}/start",
    summary="Enterprise: go live — starts the conference broadcast",
)
async def enterprise_start_conference(
    conf_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    conf = await _get_conf_or_404(conf_id)
    await _assert_assigned_enterprise(conf, current_user)

    if conf["status"] not in ("scheduled", "live"):
        raise HTTPException(status_code=400, detail=f"Cannot start a conference with status '{conf['status']}'")

    room_name = f"conf-{conf_id}"
    created = await lk.create_room(room_name)
    if not created:
        raise HTTPException(
            status_code=503,
            detail="Could not start the video server. Please try again in a moment.",
        )

    updated = await conf_repo.set_status(
        conf_id, "live",
        extra={"livekit_room_name": room_name}
    )

    # Best-effort analytics instrumentation.
    try:
        await log_event_persistent(
            type=AnalyticsEventType.CONFERENCE_JOINED,
            user_id=str(current_user["_id"]),
            event_id=str(conf.get("event_id")) if conf.get("event_id") else None,
            metadata={
                "conference_id": str(conf_id),
                "action": "speaker_start",
                "role": "speaker",
                "room_name": room_name,
            },
        )
    except Exception:
        pass

    # Notify all registered attendees
    try:
        registrations = await conf_repo.get_registrations(conf_id)
        for reg in registrations:
            await create_notification(
                user_id=reg["user_id"],
                type=NotificationType.CONFERENCE_LIVE,
                message=f"Conference \"{conf['title']}\" is now live! Click to join.",
            )
    except Exception:
        pass

    return {"session_status": "live", "room_name": room_name}


@router.post(
    "/conferences/{conf_id}/end",
    summary="Enterprise: end the conference broadcast",
)
async def enterprise_end_conference(
    conf_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    conf = await _get_conf_or_404(conf_id)
    await _assert_assigned_enterprise(conf, current_user)

    room_name = conf.get("livekit_room_name") or f"conf-{conf_id}"
    await lk.delete_room(room_name)

    await conf_repo.set_status(conf_id, "ended")
    return {"session_status": "ended"}


@router.get(
    "/conferences/{conf_id}/speaker-token",
    response_model=ConferenceTokenResponse,
    summary="Enterprise: get LiveKit speaker token (can publish video/audio)",
)
async def enterprise_speaker_token(
    conf_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    conf = await _get_conf_or_404(conf_id)
    await _assert_assigned_enterprise(conf, current_user)

    if conf["status"] not in ("live", "scheduled"):
        raise HTTPException(status_code=400, detail="Conference is not live")

    # Ensure LiveKit server is reachable
    if not await lk.ensure_livekit_running():
        raise HTTPException(status_code=503, detail="Video server is not available. Please try again.")

    room_name = conf.get("livekit_room_name") or f"conf-{conf_id}"
    uid = str(current_user["_id"])
    user_name = current_user.get("full_name") or current_user.get("email", uid)

    token = lk.generate_speaker_token(room_name, uid, user_name)
    return ConferenceTokenResponse(
        token=token,
        livekit_url=settings.LIVEKIT_WS_URL,
        room_name=room_name,
        role="speaker",
    )


# ── Public / Audience Routes ──────────────────────────────────────────────────

@router.get(
    "/conferences/",
    response_model=List[ConferenceRead],
    summary="Browse scheduled/live conferences",
)
async def list_public_conferences(
    event_id: Optional[str] = Query(None),
    conf_status: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
):
    confs = await conf_repo.list_public(event_id=event_id, status=conf_status)
    uid = str(current_user["_id"])
    return [await _enrich(c, uid) for c in confs]


@router.get(
    "/conferences/{conf_id}",
    response_model=ConferenceRead,
    summary="Get conference detail",
)
async def get_conference(
    conf_id: str,
    current_user: dict = Depends(get_current_user),
):
    conf = await _get_conf_or_404(conf_id)
    return await _enrich(conf, str(current_user["_id"]))


@router.post(
    "/conferences/{conf_id}/register",
    summary="Register to attend a conference",
    status_code=status.HTTP_201_CREATED,
)
async def register_for_conference(
    conf_id: str,
    current_user: dict = Depends(get_current_user),
):
    conf = await _get_conf_or_404(conf_id)
    if conf["status"] == "canceled":
        raise HTTPException(status_code=400, detail="Conference is canceled")

    ok = await conf_repo.register(
        conf_id, str(current_user["_id"]), str(current_user.get("role", "visitor"))
    )

    # Best-effort analytics instrumentation.
    if ok:
        try:
            await log_event_persistent(
                type=AnalyticsEventType.CONFERENCE_JOINED,
                user_id=str(current_user["_id"]),
                event_id=str(conf.get("event_id")) if conf.get("event_id") else None,
                metadata={
                    "conference_id": str(conf_id),
                    "action": "register",
                    "role": str(current_user.get("role", "visitor")),
                },
            )
        except Exception:
            pass

    if not ok:
        return {"detail": "Already registered"}
    return {"detail": "Registered successfully"}


@router.delete(
    "/conferences/{conf_id}/register",
    summary="Cancel conference registration",
)
async def unregister_from_conference(
    conf_id: str,
    current_user: dict = Depends(get_current_user),
):
    await conf_repo.unregister(conf_id, str(current_user["_id"]))
    return {"detail": "Unregistered"}


@router.get(
    "/conferences/{conf_id}/token",
    response_model=ConferenceTokenResponse,
    summary="Get LiveKit audience token (subscribe only)",
)
async def get_audience_token(
    conf_id: str,
    current_user: dict = Depends(get_current_user),
):
    conf = await _get_conf_or_404(conf_id)

    if conf["status"] != "live":
        raise HTTPException(status_code=400, detail="Conference is not live yet")

    room_name = conf.get("livekit_room_name") or f"conf-{conf_id}"
    uid = str(current_user["_id"])
    user_name = current_user.get("full_name") or current_user.get("email", uid)

    token = lk.generate_audience_token(room_name, uid, user_name)

    # Best-effort analytics instrumentation.
    try:
        await log_event_persistent(
            type=AnalyticsEventType.CONFERENCE_JOINED,
            user_id=uid,
            event_id=str(conf.get("event_id")) if conf.get("event_id") else None,
            metadata={
                "conference_id": str(conf_id),
                "action": "audience_join_live",
                "role": str(current_user.get("role", "visitor")),
                "room_name": room_name,
            },
        )
    except Exception:
        pass

    return ConferenceTokenResponse(
        token=token,
        livekit_url=settings.LIVEKIT_WS_URL,
        room_name=room_name,
        role="audience",
    )


# ── Q&A ───────────────────────────────────────────────────────────────────────

@router.post(
    "/conferences/{conf_id}/qa",
    response_model=QARead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a question (audience)",
)
async def submit_question(
    conf_id: str,
    data: QACreate,
    current_user: dict = Depends(get_current_user),
):
    await _get_conf_or_404(conf_id)
    user_name = current_user.get("full_name") or current_user.get("email", "Anonymous")
    return await conf_repo.add_question(
        conf_id, str(current_user["_id"]), user_name, data.question
    )


@router.get(
    "/conferences/{conf_id}/qa",
    response_model=List[QARead],
    summary="List Q&A for a conference (sorted by upvotes)",
)
async def list_qa(
    conf_id: str,
    current_user: dict = Depends(get_current_user),
):
    await _get_conf_or_404(conf_id)
    return await conf_repo.list_questions(conf_id)


@router.patch(
    "/conferences/{conf_id}/qa/{qa_id}/answer",
    response_model=QARead,
    summary="Answer a question (assigned enterprise only)",
)
async def answer_question(
    conf_id: str,
    qa_id: str,
    data: QAAnswer,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    conf = await _get_conf_or_404(conf_id)
    await _assert_assigned_enterprise(conf, current_user)
    result = await conf_repo.answer_question(qa_id, data.answer)
    if not result:
        raise HTTPException(status_code=404, detail="Question not found")
    return result


@router.post(
    "/conferences/{conf_id}/qa/{qa_id}/upvote",
    response_model=QARead,
    summary="Upvote a question",
)
async def upvote_question(
    conf_id: str,
    qa_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = await conf_repo.upvote_question(qa_id)
    if not result:
        raise HTTPException(status_code=404, detail="Question not found")
    return result
