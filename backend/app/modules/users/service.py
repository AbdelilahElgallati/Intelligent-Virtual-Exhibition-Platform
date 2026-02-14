from typing import Optional
from uuid import UUID
from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.users.schemas import UserCreate
from app.modules.auth.enums import Role

def get_users_collection() -> AsyncIOMotorCollection:
    """Get the users collection from MongoDB."""
    db = get_database()
    return db["users"]

async def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email from MongoDB."""
    collection = get_users_collection()
    return await collection.find_one({"email": email})

async def get_user_by_id(user_id: str | UUID) -> Optional[dict]:
    """Get user by ID from MongoDB."""
    collection = get_users_collection()
    # Support both string and UUID for ID if stored as strings
    return await collection.find_one({"id": str(user_id)})

async def create_user(user_data: dict) -> dict:
    """Create a new user in MongoDB."""
    collection = get_users_collection()
    # Convert UUID to string for storage if needed, or keep as is if driver handles it
    if "id" in user_data and isinstance(user_data["id"], UUID):
        user_data["id"] = str(user_data["id"])
    
    await collection.insert_one(user_data)
    return user_data
