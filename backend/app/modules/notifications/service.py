"""
Notification service for IVEP.

Provides MongoDB-backed notification storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.notifications.schemas import NotificationType


def _id_query(nid) -> dict:
    s = str(nid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_notifications_collection() -> AsyncIOMotorCollection:
    """Get the notifications collection from MongoDB."""
    db = get_database()
    return db["notifications"]

async def create_notification(user_id, type: NotificationType, message: str) -> dict:
    """
    Create a new notification.
    """
    now = datetime.now(timezone.utc)
    
    notification = {
        "user_id": str(user_id),
        "type": type,
        "message": message,
        "is_read": False,
        "created_at": now,
    }
    
    collection = get_notifications_collection()
    result = await collection.insert_one(notification)
    notification["_id"] = result.inserted_id
    return stringify_object_ids(notification)

async def list_user_notifications(user_id) -> List[dict]:
    """
    List notifications for a user.
    """
    collection = get_notifications_collection()
    cursor = collection.find({"user_id": str(user_id)}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return stringify_object_ids(docs)

async def mark_as_read(notification_id) -> Optional[dict]:
    """
    Mark a notification as read.
    """
    collection = get_notifications_collection()
    result = await collection.find_one_and_update(
        _id_query(notification_id),
        {"$set": {"is_read": True}},
        return_document=True
    )
    return stringify_object_ids(result) if result else None

async def mark_all_notifications_read(user_id) -> bool:
    """
    Mark all unread notifications as read for a user.
    """
    collection = get_notifications_collection()
    result = await collection.update_many(
        {"user_id": str(user_id), "is_read": False},
        {"$set": {"is_read": True}}
    )
    return result.modified_count > 0

async def get_notification_by_id(notification_id) -> Optional[dict]:
    """Get notification by _id."""
    collection = get_notifications_collection()
    doc = await collection.find_one(_id_query(notification_id))
    return stringify_object_ids(doc) if doc else None

