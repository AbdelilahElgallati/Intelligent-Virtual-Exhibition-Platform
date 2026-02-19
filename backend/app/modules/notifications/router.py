"""
Notifications module router for IVEP.

Handles notification retrieval and updates.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.modules.notifications.schemas import NotificationRead
from app.modules.notifications.service import (
    get_notification_by_id,
    list_user_notifications,
    mark_all_notifications_read,
    mark_as_read,
)


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=list[NotificationRead])
async def get_my_notifications(
    current_user: dict = Depends(get_current_user),
) -> list[NotificationRead]:
    notifications = await list_user_notifications(current_user["_id"])
    return [NotificationRead(**n) for n in notifications]


@router.post("/mark-all-read")
async def mark_all_my_notifications_read(
    current_user: dict = Depends(get_current_user),
):
    await mark_all_notifications_read(current_user["_id"])
    return {"status": "success"}


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
) -> NotificationRead:
    notification = await get_notification_by_id(notification_id)
    if notification is None or notification["user_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    updated = await mark_as_read(notification_id)
    return NotificationRead(**updated)
