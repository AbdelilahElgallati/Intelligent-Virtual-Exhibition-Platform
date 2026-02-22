from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids


def _id_query(sid) -> dict:
    s = str(sid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_stands_collection() -> AsyncIOMotorCollection:
    """Get the stands collection from MongoDB."""
    db = get_database()
    return db["stands"]


async def create_stand(event_id, organization_id, name: str, **kwargs) -> dict:
    """
    Create a new stand for an organization at an event.
    """
    now = datetime.now(timezone.utc)
    
    stand = {
        "event_id": str(event_id),
        "organization_id": str(organization_id),
        "name": name,
        "description": kwargs.get("description"),
        "logo_url": kwargs.get("logo_url"),
        "tags": kwargs.get("tags", []),
        "stand_type": kwargs.get("stand_type", "standard"),
        "category": kwargs.get("category"),
        "theme_color": kwargs.get("theme_color", "#1e293b"),
        "stand_background_url": kwargs.get("stand_background_url"),
        "presenter_avatar_bg": kwargs.get("presenter_avatar_bg", "#ffffff"),
        "presenter_name": kwargs.get("presenter_name"),
        "presenter_avatar_url": kwargs.get("presenter_avatar_url"),
        "created_at": now,
    }
    
    collection = get_stands_collection()
    result = await collection.insert_one(stand)
    stand["_id"] = result.inserted_id
    return stringify_object_ids(stand)


async def update_stand(stand_id, update_data: dict) -> Optional[dict]:
    """
    Update an existing stand.
    """
    collection = get_stands_collection()
    # Remove None values so we only update provided fields
    fields = {k: v for k, v in update_data.items() if v is not None}
    if not fields:
        return await get_stand_by_id(stand_id)
    await collection.update_one(_id_query(stand_id), {"$set": fields})
    return await get_stand_by_id(stand_id)


async def get_stand_by_id(stand_id) -> Optional[dict]:
    """Get stand by _id."""
    collection = get_stands_collection()
    doc = await collection.find_one(_id_query(stand_id))
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


async def list_event_stands(
    event_id,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    """
    List all stands for an event, with optional filtering.
    """
    collection = get_stands_collection()
    query: dict = {"event_id": str(event_id)}
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    cursor = collection.find(query)
    docs = await cursor.to_list(length=100)
    return stringify_object_ids(docs)
