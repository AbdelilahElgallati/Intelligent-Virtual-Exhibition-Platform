"""
Admin-specific routes: /admin/health, /admin/events/{event_id}/enterprise-requests,
/admin/events/{event_id}/force-start, /admin/events/{event_id}/force-close
"""
import time
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone

from app.core.dependencies import require_role
from app.modules.auth.enums import Role
from app.db.mongo import get_database
from app.modules.participants.schemas import EnterpriseRequestsResponse
from app.modules.participants.service import list_enterprise_requests
from app.modules.events.service import get_event_by_id, atomic_transition
from app.modules.events.schemas import EventRead, EventState
from app.modules.audit.service import log_audit

router = APIRouter(prefix="/admin", tags=["Admin"])

# Record process start time for uptime calculation
_START_TIME = time.time()


@router.get("/health")
async def admin_health(
    _: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Detailed platform health status (Admin only).
    Returns MongoDB connection status, uptime, and worker/process info.
    """
    # MongoDB ping
    mongo_ok = False
    mongo_latency_ms = None
    try:
        db = get_database()
        t0 = time.monotonic()
        await db.command("ping")
        mongo_latency_ms = round((time.monotonic() - t0) * 1000, 1)
        mongo_ok = True
    except Exception:
        mongo_latency_ms = None

    uptime_seconds = int(time.time() - _START_TIME)
    uptime_str = _format_uptime(uptime_seconds)

    # Redis — we don't have redis configured yet, report as "not configured"
    redis_status = "not_configured"

    overall = "healthy" if mongo_ok else "degraded"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": uptime_str,
        "uptime_seconds": uptime_seconds,
        "services": {
            "mongodb": {
                "status": "ok" if mongo_ok else "error",
                "latency_ms": mongo_latency_ms,
            },
            "redis": {
                "status": redis_status,
                "latency_ms": None,
            },
            "api": {
                "status": "ok",
                "pid": os.getpid(),
            },
        },
    }


@router.get("/events/{event_id}/enterprise-requests", response_model=EnterpriseRequestsResponse)
async def get_enterprise_requests(
    event_id: str,
    status: str = Query(default="requested", description="Filter by participant status"),
    search: Optional[str] = Query(default=None, description="Search by org name / email"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    _: dict = Depends(require_role(Role.ADMIN)),
) -> EnterpriseRequestsResponse:
    """
    Admin: List enterprise join requests for a given event.

    Returns enriched items including:
    - participant status & dates
    - enterprise user details
    - organization info (name, industry)
    - subscription plan
    - participation history

    Filters: status, search (org name / email), skip, limit
    """
    result = await list_enterprise_requests(
        event_id=event_id,
        status=status,
        search=search,
        skip=skip,
        limit=limit,
    )
    return EnterpriseRequestsResponse(**result)


# ─── Force lifecycle transitions ─────────────────────────────────────────────

@router.post(
    "/events/{event_id}/force-start",
    response_model=EventRead,
    summary="Force-start an event (Admin only)",
)
async def force_start_event(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Force an event from PAYMENT_DONE → LIVE immediately, bypassing the schedule.

    - ADMIN only
    - Allowed only when `state == payment_done`
    - Audit log: `event.force_start`
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["state"] != EventState.PAYMENT_DONE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot force-start. Current state: {event['state']}. Required: payment_done",
        )

    updated = await atomic_transition(event_id, EventState.PAYMENT_DONE, EventState.LIVE)
    if updated is None:
        # Race — already transitioned
        updated = await get_event_by_id(event_id)

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event.force_start",
        entity="event",
        entity_id=event_id,
        metadata={
            "event_id": event_id,
            "previous_state": "payment_done",
            "new_state": "live",
            "actor_id": str(current_user["_id"]),
            "title": event.get("title"),
        },
    )

    return EventRead(**updated)


@router.post(
    "/events/{event_id}/force-close",
    response_model=EventRead,
    summary="Force-close an event (Admin only)",
)
async def force_close_event(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Force an event from LIVE → CLOSED immediately.

    - ADMIN only
    - Allowed only when `state == live`
    - Audit log: `event.force_close`
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["state"] != EventState.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot force-close. Current state: {event['state']}. Required: live",
        )

    updated = await atomic_transition(event_id, EventState.LIVE, EventState.CLOSED)
    if updated is None:
        updated = await get_event_by_id(event_id)

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event.force_close",
        entity="event",
        entity_id=event_id,
        metadata={
            "event_id": event_id,
            "previous_state": "live",
            "new_state": "closed",
            "actor_id": str(current_user["_id"]),
            "title": event.get("title"),
        },
    )

    return EventRead(**updated)


def _format_uptime(seconds: int) -> str:
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    if days:
        return f"{days}d {hours}h {minutes}m"
    if hours:
        return f"{hours}h {minutes}m {secs}s"
    return f"{minutes}m {secs}s"

