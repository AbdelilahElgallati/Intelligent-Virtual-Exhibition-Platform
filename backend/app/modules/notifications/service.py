"""
Notification service for IVEP.

Provides MongoDB-backed notification storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4
from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.notifications.schemas import NotificationType

def get_notifications_collection() -> AsyncIOMotorCollection:
    """Get the notifications collection from MongoDB."""
    db = get_database()
    return db["notifications"]

async def create_notification(user_id: UUID, type: NotificationType, message: str) -> dict:
    """
    Create a new notification.
    """
    notification_id = uuid4()
    now = datetime.now(timezone.utc)
    
    notification = {
        "id": str(notification_id),
        "user_id": str(user_id),
        "type": type,
        "message": message,
        "is_read": False,
        "created_at": now,
    }
    
    collection = get_notifications_collection()
    await collection.insert_one(notification)
    return notification

async def list_user_notifications(user_id: UUID) -> List[dict]:
    """
    List notifications for a user.
    """
    collection = get_notifications_collection()
    cursor = collection.find({"user_id": str(user_id)}).sort("created_at", -1)
    return await cursor.to_list(length=100)

async def mark_as_read(notification_id: UUID) -> Optional[dict]:
    """
    Mark a notification as read.
    """
    collection = get_notifications_collection()
    return await collection.find_one_and_update(
        {"id": str(notification_id)},
        {"$set": {"is_read": True}},
        return_document=True
    )

async def mark_all_notifications_read(user_id: UUID) -> bool:
    """
    Mark all unread notifications as read for a user.
    """
    collection = get_notifications_collection()
    result = await collection.update_many(
        {"user_id": str(user_id), "is_read": False},
        {"$set": {"is_read": True}}
    )
    return result.modified_count > 0

async def get_notification_by_id(notification_id: UUID) -> Optional[dict]:
    """Get notification by ID."""
    collection = get_notifications_collection()
    return await collection.find_one({"id": str(notification_id)})
