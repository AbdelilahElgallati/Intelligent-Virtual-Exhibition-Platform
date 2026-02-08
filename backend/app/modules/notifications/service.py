"""
Notification service for IVEP.

Provides in-memory notification storage and operations.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from app.modules.notifications.schemas import NotificationType


# In-memory notification store
NOTIFICATIONS_STORE: dict[UUID, dict] = {}


def create_notification(user_id: UUID, type: NotificationType, message: str) -> dict:
    """
    Create a new notification.
    
    Args:
        user_id: Recipient user ID.
        type: Notification type.
        message: Notification message.
        
    Returns:
        dict: Created notification data.
    """
    notification_id = uuid4()
    now = datetime.now()
    
    notification = {
        "id": notification_id,
        "user_id": user_id,
        "type": type,
        "message": message,
        "is_read": False,
        "created_at": now,
    }
    
    NOTIFICATIONS_STORE[notification_id] = notification
    return notification


def list_user_notifications(user_id: UUID) -> list[dict]:
    """
    List notifications for a user.
    
    Args:
        user_id: User ID.
        
    Returns:
        list[dict]: List of notifications.
    """
    notifications = [n for n in NOTIFICATIONS_STORE.values() if n["user_id"] == user_id]
    # Return most recent first
    return sorted(notifications, key=lambda x: x["created_at"], reverse=True)


def mark_as_read(notification_id: UUID) -> Optional[dict]:
    """
    Mark a notification as read.
    
    Args:
        notification_id: Notification ID.
        
    Returns:
        dict: Updated notification or None.
    """
    notification = NOTIFICATIONS_STORE.get(notification_id)
    if notification is None:
        return None
    
    notification["is_read"] = True
    return notification


def get_notification_by_id(notification_id: UUID) -> Optional[dict]:
    """Get notification by ID."""
    return NOTIFICATIONS_STORE.get(notification_id)
