"""
Sessions service — CRUD + status transitions + schedule auto-import.

Business rules:
  - start_time < end_time  (validated in schema)
  - start_time / end_time must be within event start_date / end_date
  - start_session: scheduled → live  (atomic)
  - end_session:   live     → ended  (atomic)
  - sync_sessions_from_schedule: idempotent; creates sessions for slots
    whose label matches conference/session/keynote/talk/workshop etc.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.audit.service import log_audit
from app.modules.events.service import get_event_by_id
from app.modules.sessions.schemas import SessionCreate, SessionRead, SessionStatus

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id_query(sid: str) -> dict:
    s = str(sid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def _to_read(doc: dict) -> SessionRead:
    """Convert a MongoDB document to a SessionRead."""
    doc = stringify_object_ids(doc)
    return SessionRead(
        id=doc["id"],
        event_id=doc["event_id"],
        title=doc["title"],
        speaker=doc["speaker"],
        description=doc.get("description"),
        start_time=doc["start_time"],
        end_time=doc["end_time"],
        status=doc["status"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        started_at=doc.get("started_at"),
        ended_at=doc.get("ended_at"),
    )


# ─── CRUD ─────────────────────────────────────────────────────────────────────

async def create_session(
    event_id: str,
    data: SessionCreate,
    actor_id: str = "system",
) -> SessionRead:
    """
    Insert a new session for the event.
    Validates that the session falls within the event's date range.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise ValueError("Event not found")

    # Validate within event window (if event has start/end dates)
    event_start = event.get("start_date")
    event_end = event.get("end_date")

    def _aware(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    session_start = _aware(data.start_time)
    session_end = _aware(data.end_time)
    ev_start = _aware(event_start)
    ev_end = _aware(event_end)

    # Grace window of 1 day on each boundary to absorb browser ↔ UTC timezone
    # offset differences (±14 h worst case).  Strict intra-event scheduling is
    # left to the administrator; we only block obviously wrong years/dates.
    GRACE = timedelta(days=1)

    if ev_start and session_start < ev_start - GRACE:
        raise ValueError("session start_time is before event start_date")
    if ev_end and session_end > ev_end + GRACE:
        raise ValueError("session end_time is after event end_date")

    now = _now()
    doc = {
        "event_id": event_id,
        "title": data.title,
        "speaker": data.speaker,
        "description": data.description,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "status": SessionStatus.SCHEDULED.value,
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "ended_at": None,
    }

    db = get_database()
    result = await db.event_sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    session_id = str(result.inserted_id)

    try:
        await log_audit(
            actor_id=actor_id,
            action="session.create",
            entity="session",
            entity_id=session_id,
            metadata={
                "event_id": event_id,
                "title": data.title,
                "speaker": data.speaker,
                "start_time": data.start_time.isoformat(),
                "end_time": data.end_time.isoformat(),
            },
        )
    except Exception as exc:
        logger.warning("audit log failed for session.create %s: %s", session_id, exc)

    return _to_read(doc)


async def get_session_by_id(session_id: str) -> Optional[dict]:
    """Return raw MongoDB doc or None."""
    db = get_database()
    doc = await db.event_sessions.find_one(_id_query(session_id))
    return stringify_object_ids(doc) if doc else None


async def list_sessions(event_id: str) -> list[SessionRead]:
    """Return all sessions for an event, sorted by start_time."""
    db = get_database()
    cursor = db.event_sessions.find({"event_id": event_id}).sort("start_time", 1)
    docs = await cursor.to_list(length=500)
    return [_to_read(d) for d in docs]


# ─── Transitions ──────────────────────────────────────────────────────────────

async def start_session(session_id: str, actor_id: str = "system") -> SessionRead:
    """
    Transition session: scheduled → live.
    Raises ValueError if the session is not in 'scheduled' state.
    """
    db = get_database()
    now = _now()

    result = await db.event_sessions.find_one_and_update(
        {**_id_query(session_id), "status": SessionStatus.SCHEDULED.value},
        {"$set": {"status": SessionStatus.LIVE.value, "started_at": now, "updated_at": now}},
        return_document=True,
    )
    if result is None:
        doc = await db.event_sessions.find_one(_id_query(session_id))
        if doc is None:
            raise ValueError("Session not found")
        raise ValueError(f"Cannot start session with status '{doc['status']}'")

    session_id_str = str(result["_id"])
    try:
        await log_audit(
            actor_id=actor_id,
            action="session.start",
            entity="session",
            entity_id=session_id_str,
            metadata={"previous_status": "scheduled", "new_status": "live", "started_at": now.isoformat()},
        )
    except Exception as exc:
        logger.warning("audit log failed for session.start %s: %s", session_id_str, exc)

    return _to_read(result)


async def end_session(session_id: str, actor_id: str = "system") -> SessionRead:
    """
    Transition session: live → ended.
    Raises ValueError if the session is not in 'live' state.
    """
    db = get_database()
    now = _now()

    result = await db.event_sessions.find_one_and_update(
        {**_id_query(session_id), "status": SessionStatus.LIVE.value},
        {"$set": {"status": SessionStatus.ENDED.value, "ended_at": now, "updated_at": now}},
        return_document=True,
    )
    if result is None:
        doc = await db.event_sessions.find_one(_id_query(session_id))
        if doc is None:
            raise ValueError("Session not found")
        raise ValueError(f"Cannot end session with status '{doc['status']}'")

    session_id_str = str(result["_id"])
    try:
        await log_audit(
            actor_id=actor_id,
            action="session.end",
            entity="session",
            entity_id=session_id_str,
            metadata={"previous_status": "live", "new_status": "ended", "ended_at": now.isoformat()},
        )
    except Exception as exc:
        logger.warning("audit log failed for session.end %s: %s", session_id_str, exc)

    return _to_read(result)


# ─── Schedule auto-import ─────────────────────────────────────────────────────

# Keywords that indicate a schedule slot is a conference/session activity
_SESSION_KEYWORDS = frozenset([
    "conference", "session", "keynote", "talk", "workshop",
    "panel", "presentation", "seminar", "lecture", "demo",
    "webinar", "roundtable",
])


def _is_conference_slot(label: str) -> bool:
    """Return True when the slot label matches any session keyword."""
    lower = label.lower()
    return any(kw in lower for kw in _SESSION_KEYWORDS)


def _parse_hhmm(time_str: str, base_date: datetime) -> datetime:
    """
    Convert 'HH:MM' string + calendar date → timezone-aware datetime (UTC).
    """
    parts = time_str.strip().split(":")
    hour = int(parts[0])
    minute = int(parts[1]) if len(parts) > 1 else 0
    return base_date.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=timezone.utc)


async def sync_sessions_from_schedule(
    event_id: str,
    actor_id: str = "system",
) -> list[SessionRead]:
    """
    Read the event's schedule_days and auto-create sessions for any slot whose
    label contains a conference/session keyword (e.g. 'keynote', 'workshop').

    Slots that already have a matching session (same event_id + start_time) are
    skipped so the function is fully idempotent.

    Returns a list of newly created SessionRead objects.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise ValueError("Event not found")

    schedule_days = event.get("schedule_days") or []
    if not schedule_days:
        return []

    event_start: Optional[datetime] = event.get("start_date")
    if event_start is None:
        raise ValueError("Event has no start_date; cannot resolve slot times")

    if event_start.tzinfo is None:
        event_start = event_start.replace(tzinfo=timezone.utc)

    db = get_database()
    created: list[SessionRead] = []

    for day in schedule_days:
        # Accept both dict (from MongoDB) and ScheduleDay pydantic objects
        if isinstance(day, dict):
            day_number = int(day.get("day_number", 1))
            slots = day.get("slots", [])
            date_label = day.get("date_label")
        else:
            day_number = int(day.day_number)
            slots = day.slots
            date_label = day.date_label

        # Calendar date for this day (UTC midnight)
        day_date = (event_start + timedelta(days=day_number - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        for slot in slots:
            if isinstance(slot, dict):
                label = slot.get("label", "")
                slot_start_str = slot.get("start_time", "09:00")
                slot_end_str = slot.get("end_time", "10:00")
            else:
                label = slot.label
                slot_start_str = slot.start_time
                slot_end_str = slot.end_time

            if not _is_conference_slot(label):
                continue

            try:
                slot_start = _parse_hhmm(slot_start_str, day_date)
                slot_end = _parse_hhmm(slot_end_str, day_date)
            except (ValueError, IndexError) as exc:
                logger.warning("Skipping malformed slot '%s': %s", label, exc)
                continue

            if slot_start >= slot_end:
                logger.warning("Skipping slot '%s' — start >= end", label)
                continue

            # Idempotency check: skip if a session already exists for this time
            existing = await db.event_sessions.find_one({
                "event_id": event_id,
                "start_time": slot_start,
            })
            if existing:
                continue

            now = _now()
            doc = {
                "event_id": event_id,
                "title": label,
                "speaker": "",  # admin can fill later
                "description": (
                    f"Auto-imported from Day {day_number} schedule"
                    + (f" ({date_label})" if date_label else "")
                ),
                "start_time": slot_start,
                "end_time": slot_end,
                "status": SessionStatus.SCHEDULED.value,
                "created_at": now,
                "updated_at": now,
                "started_at": None,
                "ended_at": None,
            }
            result = await db.event_sessions.insert_one(doc)
            doc["_id"] = result.inserted_id
            session_id = str(result.inserted_id)

            try:
                await log_audit(
                    actor_id=actor_id,
                    action="session.create",
                    entity="session",
                    entity_id=session_id,
                    metadata={
                        "event_id": event_id,
                        "title": label,
                        "source": "schedule_sync",
                        "start_time": slot_start.isoformat(),
                        "end_time": slot_end.isoformat(),
                    },
                )
            except Exception as exc:
                logger.warning("audit log failed for schedule sync %s: %s", session_id, exc)

            created.append(_to_read(doc))
            logger.info("[sessions] auto-created '%s' from schedule (event %s)", label, event_id)

    return created
