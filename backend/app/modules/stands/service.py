from datetime import datetime, timezone
from typing import Optional
import re

from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids


def _slugify(text: str) -> str:
    """Convert any string into a URL-safe kebab-case slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text[:60].strip("-")


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

    # Auto-generate URL-safe slug: stand-name-slug + 4-char hex from _id
    base_slug = _slugify(name)
    short_suffix = str(result.inserted_id)[-4:]
    slug = f"{base_slug}-{short_suffix}" if base_slug else short_suffix
    await collection.update_one({"_id": result.inserted_id}, {"$set": {"slug": slug}})
    stand["slug"] = slug

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
    """Get stand by _id **or slug** — transparent backward compat."""
    collection = get_stands_collection()
    # Try ObjectId first
    if ObjectId.is_valid(str(stand_id)):
        doc = await collection.find_one({"_id": ObjectId(str(stand_id))})
        if doc:
            return stringify_object_ids(doc)
    # Fall back to slug
    doc = await collection.find_one({"slug": str(stand_id)})
    return stringify_object_ids(doc) if doc else None


async def resolve_stand_id(slug_or_id: str) -> str:
    """Helper for sub-routers: resolve a stand slug to its true ObjectId string."""
    if not slug_or_id:
        return ""
    if ObjectId.is_valid(str(slug_or_id)):
        return str(slug_or_id)
    collection = get_stands_collection()
    doc = await collection.find_one({"slug": str(slug_or_id)}, {"_id": 1})
    if not doc:
        return str(slug_or_id)  # let it fail downstream
    return str(doc["_id"])


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
    tags: Optional[list[str]] = None,
    limit: int = 9,
    skip: int = 0,
) -> dict:
    """
    List all stands for an event, with optional filtering and pagination.
    
    Returns dict with items, total, limit, skip.
    """
    from app.modules.events.service import resolve_event_id
    event_id = await resolve_event_id(event_id)
    
    collection = get_stands_collection()
    query: dict = {"event_id": str(event_id)}
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if tags:
        query["tags"] = {"$in": tags}
    
    # Get total count for pagination
    total = await collection.count_documents(query)
    
    # Apply pagination
    cursor = collection.find(query).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    
    return {
        "items": stringify_object_ids(docs),
        "total": total,
        "limit": limit,
        "skip": skip,
    }
