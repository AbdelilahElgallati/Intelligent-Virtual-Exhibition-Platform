from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids


def get_stands_collection() -> AsyncIOMotorCollection:
    """Get the stands collection from MongoDB."""
    db = get_database()
    return db["stands"]


async def create_stand(event_id, organization_id, name: str) -> dict:
    """
    Create a new stand for an organization at an event.
    """
    stand_id = uuid4()
    now = datetime.now(timezone.utc)
    
    stand = {
        "id": str(stand_id),
        "event_id": str(event_id),
        "organization_id": str(organization_id),
        "name": name,
        "description": None,
        "logo_url": None,
        "tags": [],
        "stand_type": "standard",
        "created_at": now,
    }
    
    collection = get_stands_collection()
    await collection.insert_one(stand)
    return stringify_object_ids(stand)


async def get_stand_by_id(stand_id) -> Optional[dict]:
    """Get stand by ID (accepts id or _id)."""
    collection = get_stands_collection()
    query = {"id": str(stand_id)}
    if ObjectId.is_valid(str(stand_id)):
        query = {"$or": [{"id": str(stand_id)}, {"_id": ObjectId(str(stand_id))}]}
    doc = await collection.find_one(query)
    return stringify_object_ids(doc) if doc else None


async def get_stand_by_org(event_id, organization_id) -> Optional[dict]:
    """
    Get stand for an organization at an event.
    """
    collection = get_stands_collection()
    doc = await collection.find_one({
        "event_id": str(event_id), 
        "organization_id": str(organization_id)
    })
    return stringify_object_ids(doc) if doc else None


async def list_event_stands(event_id) -> list[dict]:
    """
    List all stands for an event.
    """
    collection = get_stands_collection()
    cursor = collection.find({"event_id": str(event_id)})
    docs = await cursor.to_list(length=100)
    return stringify_object_ids(docs)
