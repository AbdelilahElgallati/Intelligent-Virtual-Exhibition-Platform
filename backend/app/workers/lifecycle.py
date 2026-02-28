"""
Event lifecycle worker for IVEP.

Automatically transitions events:
  - payment_done + start_date <= now  →  live    (event.auto_start)
  - live        + end_date   <  now   →  closed  (event.auto_close)

Designed to be run as a background asyncio task started from the FastAPI lifespan.
The core logic lives in `run_lifecycle_tick(now=...)` so tests can drive it directly
without waiting for the scheduler loop.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.audit.service import log_audit

logger = logging.getLogger(__name__)

TICK_INTERVAL_SECONDS = 60  # run every 60 s


# ─── Core tick ────────────────────────────────────────────────────────────────

async def run_lifecycle_tick(now: Optional[datetime] = None) -> dict:
    """
    Check all events and apply automatic lifecycle transitions.

    Args:
        now: Override the current time (used in tests for deterministic results).

    Returns:
        A summary dict: {"started": [...event_ids], "closed": [...event_ids]}
    """
    if now is None:
        now = datetime.now(timezone.utc)

    db = get_database()
    col = db["events"]

    started_ids: list[str] = []
    closed_ids: list[str] = []

    # ── Auto-start: payment_done AND start_date <= now ────────────────────────
    async for event in col.find(
        {"state": "payment_done", "start_date": {"$lte": now}}
    ):
        event_id = str(event["_id"])
        # Atomic: only update if still payment_done (idempotent)
        result = await col.find_one_and_update(
            {"_id": event["_id"], "state": "payment_done"},
            {"$set": {"state": "live"}},
            return_document=True,
        )
        if result is None:
            # Another process already transitioned it
            continue

        started_ids.append(event_id)
        logger.info("[lifecycle] auto-started event %s", event_id)

        try:
            await log_audit(
                actor_id="system",
                action="event.auto_start",
                entity="event",
                entity_id=event_id,
                metadata={
                    "previous_state": "payment_done",
                    "new_state": "live",
                    "start_date": event.get("start_date").isoformat() if event.get("start_date") else None,
                    "triggered_at": now.isoformat(),
                    "title": event.get("title"),
                },
            )
        except Exception as exc:
            logger.warning("[lifecycle] audit log failed for auto_start %s: %s", event_id, exc)

    # ── Auto-close: live AND end_date < now ───────────────────────────────────
    async for event in col.find(
        {"state": "live", "end_date": {"$lt": now}}
    ):
        event_id = str(event["_id"])
        result = await col.find_one_and_update(
            {"_id": event["_id"], "state": "live"},
            {"$set": {"state": "closed"}},
            return_document=True,
        )
        if result is None:
            continue

        closed_ids.append(event_id)
        logger.info("[lifecycle] auto-closed event %s", event_id)

        try:
            await log_audit(
                actor_id="system",
                action="event.auto_close",
                entity="event",
                entity_id=event_id,
                metadata={
                    "previous_state": "live",
                    "new_state": "closed",
                    "end_date": event.get("end_date").isoformat() if event.get("end_date") else None,
                    "triggered_at": now.isoformat(),
                    "title": event.get("title"),
                },
            )
        except Exception as exc:
            logger.warning("[lifecycle] audit log failed for auto_close %s: %s", event_id, exc)

    return {"started": started_ids, "closed": closed_ids}


async def run_session_tick(now: Optional[datetime] = None) -> dict:
    """
    Check all event_sessions and apply automatic status transitions.

      scheduled + start_time <= now  →  live    (session.auto_start)
      live      + end_time   <= now  →  ended   (session.auto_end)

    Args:
        now: Override current time (used in tests for deterministic results).

    Returns:
        {"started": [...session_ids], "ended": [...session_ids]}
    """
    if now is None:
        now = datetime.now(timezone.utc)

    db = get_database()
    col = db["event_sessions"]

    started_ids: list[str] = []
    ended_ids: list[str] = []

    # ── Auto-start: scheduled AND start_time <= now ────────────────────────────
    async for session in col.find(
        {"status": "scheduled", "start_time": {"$lte": now}}
    ):
        session_id = str(session["_id"])
        result = await col.find_one_and_update(
            {"_id": session["_id"], "status": "scheduled"},
            {"$set": {"status": "live", "started_at": now, "updated_at": now}},
            return_document=True,
        )
        if result is None:
            continue

        started_ids.append(session_id)
        logger.info("[lifecycle] auto-started session %s", session_id)

        try:
            await log_audit(
                actor_id="system",
                action="session.auto_start",
                entity="session",
                entity_id=session_id,
                metadata={
                    "previous_status": "scheduled",
                    "new_status": "live",
                    "start_time": session.get("start_time").isoformat() if session.get("start_time") else None,
                    "triggered_at": now.isoformat(),
                    "title": session.get("title"),
                },
            )
        except Exception as exc:
            logger.warning("[lifecycle] audit log failed for session.auto_start %s: %s", session_id, exc)

    # ── Auto-end: live AND end_time <= now ────────────────────────────────────
    async for session in col.find(
        {"status": "live", "end_time": {"$lte": now}}
    ):
        session_id = str(session["_id"])
        result = await col.find_one_and_update(
            {"_id": session["_id"], "status": "live"},
            {"$set": {"status": "ended", "ended_at": now, "updated_at": now}},
            return_document=True,
        )
        if result is None:
            continue

        ended_ids.append(session_id)
        logger.info("[lifecycle] auto-ended session %s", session_id)

        try:
            await log_audit(
                actor_id="system",
                action="session.auto_end",
                entity="session",
                entity_id=session_id,
                metadata={
                    "previous_status": "live",
                    "new_status": "ended",
                    "end_time": session.get("end_time").isoformat() if session.get("end_time") else None,
                    "triggered_at": now.isoformat(),
                    "title": session.get("title"),
                },
            )
        except Exception as exc:
            logger.warning("[lifecycle] audit log failed for session.auto_end %s: %s", session_id, exc)

    return {"started": started_ids, "ended": ended_ids}


# ─── Scheduler loop ───────────────────────────────────────────────────────────

async def lifecycle_loop() -> None:
    """
    Infinite background loop that runs run_lifecycle_tick() and run_session_tick()
    every TICK_INTERVAL_SECONDS. Started from the FastAPI lifespan context manager.
    """
    logger.info("[lifecycle] scheduler started (interval=%ds)", TICK_INTERVAL_SECONDS)
    while True:
        try:
            now = datetime.now(timezone.utc)
            event_result, session_result = await asyncio.gather(
                run_lifecycle_tick(now=now),
                run_session_tick(now=now),
            )
            if any([event_result["started"], event_result["closed"],
                    session_result["started"], session_result["ended"]]):
                logger.info(
                    "[lifecycle] tick: events started=%s closed=%s | sessions started=%s ended=%s",
                    event_result["started"], event_result["closed"],
                    session_result["started"], session_result["ended"],
                )
        except Exception as exc:
            logger.error("[lifecycle] tick error: %s", exc, exc_info=True)
        await asyncio.sleep(TICK_INTERVAL_SECONDS)

