from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.favorites.schemas import FavoriteCreate


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
    existing = await col.find_one({
        "user_id": str(user_id),
        "target_type": data.target_type,
        "target_id": data.target_id,
    })
    if existing:
        return stringify_object_ids(existing)

    doc = {
        "user_id": str(user_id),
        "target_type": data.target_type,
        "target_id": data.target_id,
        "created_at": datetime.now(timezone.utc),
    }
    result = await col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return stringify_object_ids(doc)


async def delete_favorite(favorite_id: str, user_id: str) -> bool:
    col = get_favorites_collection()
    query = {"_id": ObjectId(favorite_id), "user_id": str(user_id)} if ObjectId.is_valid(favorite_id) else {"id": favorite_id, "user_id": str(user_id)}
    result = await col.delete_one(query)
    return result.deleted_count > 0
