"""
Monitoring router — Admin-only live metrics for events.

Endpoints:
    GET  /admin/events/{event_id}/live-metrics
    WS   /admin/events/{event_id}/monitoring/ws   (push every 5 s)
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.core.dependencies import require_role
from app.modules.auth.enums import Role
from app.modules.events.service import get_event_by_id
from app.modules.monitoring.schemas import LiveMetricsResponse
from app.modules.monitoring.service import get_live_metrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Monitoring"])


# ─── REST endpoint ────────────────────────────────────────────────────────────

@router.get(
    "/events/{event_id}/live-metrics",
    response_model=LiveMetricsResponse,
    summary="Get live operational metrics for an event (Admin only)",
)
async def live_metrics(
    event_id: str,
    _: dict = Depends(require_role(Role.ADMIN)),
) -> LiveMetricsResponse:
    """
    Returns real-time KPIs, active users, and recent content flags for the event.

    Aggregates:
    - Active visitors (in-memory presence)
    - Active stands (recent chat activity)
    - Ongoing approved meetings
    - Messages per minute
    - Resource downloads in last hour
    - Open incident/content flags
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return await get_live_metrics(event_id)


# ─── WebSocket push endpoint ──────────────────────────────────────────────────

@router.websocket("/events/{event_id}/monitoring/ws")
async def monitoring_ws(
    websocket: WebSocket,
    event_id: str,
    token: str = Query(...),
):
    """
    WebSocket endpoint that pushes live metrics every 5 seconds.
    Requires a valid admin JWT passed as ?token=<jwt>.
    """
    from app.core.security import decode_token
    from app.modules.users.service import get_user_by_id

    # Authenticate
    payload = decode_token(token) if token else None
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await get_user_by_id(payload.get("sub", ""))
    if not user or user.get("role") not in (Role.ADMIN, Role.ADMIN.value):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Verify event exists
    event = await get_event_by_id(event_id)
    if event is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    logger.info("Monitoring WS connected for event %s by admin %s", event_id, user.get("_id"))

    try:
        while True:
            try:
                metrics = await get_live_metrics(event_id)
                await websocket.send_text(metrics.model_dump_json())
            except Exception as e:
                logger.error("Monitoring WS metrics error: %s", e)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        logger.info("Monitoring WS disconnected for event %s", event_id)
    except Exception as e:
        logger.error("Monitoring WS unexpected error: %s", e)
