from typing import Optional
from uuid import UUID
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
    """Get user by ID from MongoDB."""
    collection = get_users_collection()
    # Support both string and UUID for ID if stored as strings
    doc = await collection.find_one({"id": str(user_id)})
    return stringify_object_ids(doc) if doc else None

async def create_user(user_data: dict) -> dict:
    """Create a new user in MongoDB."""
    collection = get_users_collection()
    # Convert UUID to string for storage if needed, or keep as is if driver handles it
    if "id" in user_data and isinstance(user_data["id"], UUID):
        user_data["id"] = str(user_data["id"])
    
    await collection.insert_one(user_data)
    return stringify_object_ids(user_data)

async def update_user_profile(user_id: str | UUID, update_data: dict) -> Optional[dict]:
    """
    Update user profile fields in MongoDB.
    
    Uses $set so only provided fields are changed — existing fields are preserved.
    """
    collection = get_users_collection()
    result = await collection.find_one_and_update(
        {"id": str(user_id)},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    return stringify_object_ids(result) if result else None
