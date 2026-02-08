"""
Notifications module router for IVEP.

Handles notification retrieval and updates.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.modules.notifications.schemas import NotificationRead
from app.modules.notifications.service import (
    get_notification_by_id,
    list_user_notifications,
    mark_as_read,
)


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=list[NotificationRead])
async def get_my_notifications(
    current_user: dict = Depends(get_current_user),
) -> list[NotificationRead]:
    """
    Get current user's notifications.
    
    Authenticated users only.
    """
    notifications = list_user_notifications(current_user["id"])
    return [NotificationRead(**n) for n in notifications]


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: UUID,
    current_user: dict = Depends(get_current_user),
) -> NotificationRead:
    """
    Mark a notification as read.
    
    Authenticated users only.
    """
    notification = get_notification_by_id(notification_id)
    if notification is None or notification["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    updated = mark_as_read(notification_id)
    return NotificationRead(**updated)
