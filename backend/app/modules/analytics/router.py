"""
Analytics module router for IVEP.
"""

from fastapi import APIRouter, Depends, Query, status
from typing import List

from app.core.dependencies import get_current_user, require_roles, require_role
from app.modules.auth.enums import Role

from .schemas import (
    AnalyticsEventCreate, AnalyticsEventRead,
    DashboardData, AnalyticsRequest
)

from .service import list_events, log_event
from .repository import analytics_repo


router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/log", response_model=AnalyticsEventRead, status_code=status.HTTP_201_CREATED)
async def log_analytics_event(
    data: AnalyticsEventCreate,
    current_user: dict = Depends(get_current_user),
) -> AnalyticsEventRead:
    """Log an analytics event (authenticated users only)."""
    event = log_event(
        type=data.type,
        user_id=current_user.get("_id"),
        event_id=data.event_id,
        stand_id=data.stand_id,
    )
    return AnalyticsEventRead(**event)


@router.get("/", response_model=List[AnalyticsEventRead])
async def get_analytics_events(
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> List[AnalyticsEventRead]:
    """Get all analytics events (Admin or Organizer only)."""
    events = list_events(limit=limit)
    return [AnalyticsEventRead(**e) for e in events]


@router.get("/stand/{id}", response_model=DashboardData)
async def get_stand_metrics(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    return await analytics_repo.get_stand_analytics(id)


@router.get("/event/{id}", response_model=DashboardData)
async def get_event_metrics(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    return await analytics_repo.get_event_analytics(id)


@router.get("/platform", response_model=DashboardData)
async def get_platform_metrics(
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """Platform-wide KPI aggregation (Admin only)."""
    return await analytics_repo.get_platform_metrics()
