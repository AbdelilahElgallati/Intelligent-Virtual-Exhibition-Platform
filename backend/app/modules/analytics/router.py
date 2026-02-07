from fastapi import APIRouter, Depends, HTTPException
from .schemas import DashboardData, AnalyticsRequest
from .repository import analytics_repo
from ...core.dependencies import get_current_user

router = APIRouter()

@router.get("/stand/{id}", response_model=DashboardData)
async def get_stand_metrics(id: str, current_user: dict = Depends(get_current_user)):
    # Verify ownership in production
    return await analytics_repo.get_stand_analytics(id)

@router.get("/event/{id}", response_model=DashboardData)
async def get_event_metrics(id: str, current_user: dict = Depends(get_current_user)):
    return await analytics_repo.get_event_analytics(id)

@router.get("/platform", response_model=DashboardData)
async def get_platform_metrics(current_user: dict = Depends(get_current_user)):
    # Check admin role in production
    return await analytics_repo.get_stand_analytics("all") # Mocked
