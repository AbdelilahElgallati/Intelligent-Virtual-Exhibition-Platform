from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorCollection

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.favorites.schemas import FavoriteCreate
from app.modules.events.service import resolve_event_id
from app.modules.stands.service import resolve_stand_id
from app.modules.organizations.service import resolve_organization_id


def get_favorites_collection() -> AsyncIOMotorCollection:
    db = get_database()
    return db["favorites"]


async def list_favorites(user_id: str) -> List[dict]:
    col = get_favorites_collection()
    cursor = col.find({"user_id": str(user_id)})
    docs = await cursor.to_list(length=200)
    return stringify_object_ids(docs)


async def create_favorite(user_id: str, data: FavoriteCreate) -> dict:
    col = get_favorites_collection()

    db = get_database()
    target_collection_name = {
        "event": "events",
        "stand": "stands",
        "organization": "organizations",
    }[data.target_type]
    target_collection = db[target_collection_name]

    resolved_target_id = data.target_id
    if data.target_type == "event":
        resolved_target_id = await resolve_event_id(data.target_id)
    elif data.target_type == "stand":
        resolved_target_id = await resolve_stand_id(data.target_id)
    elif data.target_type == "organization":
        resolved_target_id = await resolve_organization_id(data.target_id)

    target_doc = await target_collection.find_one({"_id": ObjectId(resolved_target_id)}, {"_id": 1})
    if not target_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{data.target_type.capitalize()} not found",
        )

    existing = await col.find_one({
        "user_id": str(user_id),
        "target_type": data.target_type,
        "target_id": resolved_target_id,
    })
    if existing:
        return stringify_object_ids(existing)

    doc = {
        "user_id": str(user_id),
        "target_type": data.target_type,
        "target_id": resolved_target_id,
        "created_at": datetime.now(timezone.utc),
    }
    result = await col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return stringify_object_ids(doc)


async def delete_favorite(favorite_id: str, user_id: str) -> bool:
    col = get_favorites_collection()
    if ObjectId.is_valid(favorite_id):
        query = {"_id": ObjectId(favorite_id), "user_id": str(user_id)}
    else:
        query = {"_id": favorite_id, "user_id": str(user_id)}
    result = await col.delete_one(query)
    return result.deleted_count > 0
