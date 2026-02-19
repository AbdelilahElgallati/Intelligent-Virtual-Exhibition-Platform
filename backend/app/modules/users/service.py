from typing import Optional
from uuid import UUID
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import ReturnDocument
from app.db.mongo import get_database
from app.modules.users.schemas import UserCreate
from app.modules.auth.enums import Role
from app.db.utils import stringify_object_ids

def get_users_collection() -> AsyncIOMotorCollection:
    """Get the users collection from MongoDB."""
    db = get_database()
    return db["users"]

async def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email from MongoDB."""
    collection = get_users_collection()
    doc = await collection.find_one({"email": email})
    return stringify_object_ids(doc) if doc else None

async def get_user_by_id(user_id: str | UUID) -> Optional[dict]:
    """Get user by ID from MongoDB (uses _id)."""
    collection = get_users_collection()
    uid = str(user_id)
    # Try as ObjectId first, fall back to string match
    if ObjectId.is_valid(uid):
        doc = await collection.find_one({"_id": ObjectId(uid)})
    else:
        doc = await collection.find_one({"_id": uid})
    return stringify_object_ids(doc) if doc else None

async def create_user(user_data: dict) -> dict:
    """Create a new user in MongoDB."""
    collection = get_users_collection()
    # Remove any manually set id — let MongoDB generate _id
    user_data.pop("id", None)
    
    result = await collection.insert_one(user_data)
    user_data["_id"] = result.inserted_id
    return stringify_object_ids(user_data)

async def update_user_profile(user_id: str | UUID, update_data: dict) -> Optional[dict]:
    """
    Update user profile fields in MongoDB.
    
    Uses $set so only provided fields are changed — existing fields are preserved.
    """
    collection = get_users_collection()
    uid = str(user_id)
    # Build query for _id
    query = {"_id": ObjectId(uid)} if ObjectId.is_valid(uid) else {"_id": uid}
    result = await collection.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    return stringify_object_ids(result) if result else None
