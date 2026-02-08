"""
Analytics module router for IVEP.

Handles analytics logging and retrieval.
"""

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import get_current_user, require_roles
from app.modules.analytics.schemas import AnalyticsEventCreate, AnalyticsEventRead
from app.modules.analytics.service import list_events, log_event
from app.modules.auth.schemas import Role


router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/log", response_model=AnalyticsEventRead, status_code=status.HTTP_201_CREATED)
async def log_analytics_event(
    data: AnalyticsEventCreate,
    current_user: dict = Depends(get_current_user),
) -> AnalyticsEventRead:
    """
    Log an analytics event.
    
    Authenticated users only.
    """
    # Override user_id with current user just in case, or allow it if trusted
    # For now, let's enforce current user to prevent spoofing
    event = log_event(
        type=data.type,
        user_id=current_user["id"],
        event_id=data.event_id,
        stand_id=data.stand_id,
    )
    return AnalyticsEventRead(**event)


@router.get("/", response_model=list[AnalyticsEventRead])
async def get_analytics_events(
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> list[AnalyticsEventRead]:
    """
    Get all analytics events.
    
    Admin or Organizer only.
    """
    events = list_events(limit=limit)
    return [AnalyticsEventRead(**e) for e in events]
