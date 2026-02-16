from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database


def get_stands_collection() -> AsyncIOMotorCollection:
    """Get the stands collection from MongoDB."""
    db = get_database()
    return db["stands"]


async def create_stand(event_id: UUID, organization_id: UUID, name: str) -> dict:
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
    return stand


async def get_stand_by_id(stand_id: UUID) -> Optional[dict]:
    """Get stand by ID."""
    collection = get_stands_collection()
    return await collection.find_one({"id": str(stand_id)})


async def get_stand_by_org(event_id: UUID, organization_id: UUID) -> Optional[dict]:
    """
    Get stand for an organization at an event.
    """
    collection = get_stands_collection()
    return await collection.find_one({
        "event_id": str(event_id), 
        "organization_id": str(organization_id)
    })


async def list_event_stands(event_id: UUID) -> list[dict]:
    """
    List all stands for an event.
    """
    collection = get_stands_collection()
    cursor = collection.find({"event_id": str(event_id)})
    return await cursor.to_list(length=100)
