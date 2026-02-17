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
    mark_all_notifications_read,
    mark_as_read,
)


router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _normalize_notification(raw: dict) -> dict:
    """Prepare Mongo notification dict for Pydantic parsing."""

    normalized = {**raw}

    # Ensure we always expose an id as string, preferring explicit id then _id.
    mongo_id = normalized.get("_id")
    if mongo_id is not None:
        normalized["id"] = str(normalized.get("id", mongo_id))
    elif normalized.get("id") is not None:
        normalized["id"] = str(normalized["id"])

    # Be tolerant of legacy/unknown types by forcing string casting.
    if normalized.get("type") is not None:
        normalized["type"] = str(normalized["type"])

    return normalized


@router.get("/", response_model=list[NotificationRead])
async def get_my_notifications(
    current_user: dict = Depends(get_current_user),
) -> list[NotificationRead]:
    """
    Get current user's notifications.
    
    Authenticated users only.
    """
    notifications = await list_user_notifications(current_user["id"])
    return [NotificationRead(**_normalize_notification(n)) for n in notifications]


@router.post("/mark-all-read")
async def mark_all_my_notifications_read(
    current_user: dict = Depends(get_current_user),
):
    """
    Mark all notifications as read for current user.
    """
    await mark_all_notifications_read(current_user["id"])
    return {"status": "success"}


@router.post("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: UUID,
    current_user: dict = Depends(get_current_user),
) -> NotificationRead:
    """
    Mark a notification as read.
    
    Authenticated users only.
    """
    notification = await get_notification_by_id(notification_id)
    if notification is None or notification["user_id"] != str(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    updated = await mark_as_read(notification_id)
    return NotificationRead(**_normalize_notification(updated))
