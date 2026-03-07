"""
Sessions router — Admin-only conference session management.

Endpoints:
    POST   /admin/events/{event_id}/sessions              — create session
    POST   /admin/events/{event_id}/sessions/sync         — import from schedule
    GET    /admin/events/{event_id}/sessions              — list sessions (admin)
    PATCH  /admin/sessions/{session_id}/start             — manual start
    PATCH  /admin/sessions/{session_id}/end               — manual end
    GET    /events/{event_id}/sessions                    — public timeline
"""
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user, require_role
from app.modules.auth.enums import Role
from app.modules.events.service import get_event_by_id
from app.modules.sessions.schemas import SessionCreate, SessionRead
from app.modules.sessions.service import (
    create_session,
    end_session,
    list_sessions,
    start_session,
    sync_sessions_from_schedule,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sessions"])


# ─── Admin endpoints ──────────────────────────────────────────────────────────

@router.post(
    "/admin/events/{event_id}/sessions",
    response_model=SessionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conference session (Admin only)",
)
async def create_session_endpoint(
    event_id: str,
    body: SessionCreate,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> SessionRead:
    """Create a new session for the event programme."""
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    try:
        return await create_session(
            event_id=event_id,
            data=body,
            actor_id=str(current_user.get("_id", "system")),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post(
    "/admin/events/{event_id}/sessions/sync",
    response_model=List[SessionRead],
    summary="Auto-import sessions from event schedule (Admin only)",
)
async def sync_sessions_endpoint(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> List[SessionRead]:
    """
    Scan the event's schedule_days for conference/session/keynote/workshop slots
    and create corresponding sessions. Idempotent — existing sessions are skipped.
    Returns only the newly created sessions.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    try:
        return await sync_sessions_from_schedule(
            event_id=event_id,
            actor_id=str(current_user.get("_id", "system")),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get(
    "/admin/events/{event_id}/sessions",
    response_model=List[SessionRead],
    summary="List all sessions for an event (Admin only)",
)
async def list_sessions_admin(
    event_id: str,
    _: dict = Depends(require_role(Role.ADMIN)),
) -> List[SessionRead]:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return await list_sessions(event_id)


@router.patch(
    "/admin/sessions/{session_id}/start",
    response_model=SessionRead,
    summary="Manually start a session (Admin only)",
)
async def start_session_endpoint(
    session_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> SessionRead:
    """Transition session from scheduled → live."""
    try:
        return await start_session(
            session_id=session_id,
            actor_id=str(current_user.get("_id", "system")),
        )
    except ValueError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


@router.patch(
    "/admin/sessions/{session_id}/end",
    response_model=SessionRead,
    summary="Manually end a session (Admin only)",
)
async def end_session_endpoint(
    session_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> SessionRead:
    """Transition session from live → ended."""
    try:
        return await end_session(
            session_id=session_id,
            actor_id=str(current_user.get("_id", "system")),
        )
    except ValueError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


# ─── Public endpoint ──────────────────────────────────────────────────────────

@router.get(
    "/events/{event_id}/sessions",
    response_model=List[SessionRead],
    summary="Get public session schedule for an event",
)
async def list_sessions_public(
    event_id: str,
    _: dict = Depends(get_current_user),
) -> List[SessionRead]:
    """Return all sessions (any status) for an event. Used for visitor timeline."""
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return await list_sessions(event_id)
