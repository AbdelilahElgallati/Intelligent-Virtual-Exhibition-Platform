"""
Event service for IVEP.

Provides MongoDB-backed event storage and CRUD operations.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.events.schemas import EventCreate, EventState, EventUpdate
from app.db.utils import stringify_object_ids


def _id_query(eid) -> dict:
    """Build a query dict that matches _id (ObjectId or string)."""
    s = str(eid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_events_collection() -> AsyncIOMotorCollection:
    """Get the events collection from MongoDB."""
    db = get_database()
    return db["events"]


async def create_event(data: EventCreate, organizer_id) -> dict:
    """
    Create a new event in DRAFT state.
    """
    now = datetime.now(timezone.utc)
    
    event = {
        "title": data.title,
        "description": data.description,
        "organizer_id": str(organizer_id),
        "state": EventState.DRAFT,
        "banner_url": data.banner_url,
        "category": data.category or "Exhibition",
        "start_date": data.start_date or now,
        "end_date": data.end_date or now,
        "location": data.location or "Virtual Platform",
        "tags": data.tags or [],
        "organizer_name": data.organizer_name,
        "created_at": now,
    }
    
    collection = get_events_collection()
    result = await collection.insert_one(event)
    event["_id"] = result.inserted_id
    return stringify_object_ids(event)


async def get_event_by_id(event_id) -> Optional[dict]:
    """
    Get event by ID (_id).
    """
    collection = get_events_collection()
    doc = await collection.find_one(_id_query(event_id))
    return stringify_object_ids(doc) if doc else None


async def list_events(
    organizer_id: Optional[str] = None,
    state: Optional[EventState] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    """
    List all events with optional filters.
    """
    collection = get_events_collection()
    query = {}
    
    if organizer_id:
        query["organizer_id"] = str(organizer_id)
    
    if state:
        query["state"] = state

    if category:
        query["category"] = category

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = collection.find(query)
    events = await cursor.to_list(length=100)
    return stringify_object_ids(events)


async def update_event(event_id, data: EventUpdate) -> Optional[dict]:
    """
    Update an event's fields.
    Only non-None values from the payload are applied.
    """
    collection = get_events_collection()
    update_data = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    
    if not update_data:
        return await get_event_by_id(event_id)
    
    result = await collection.find_one_and_update(
        _id_query(event_id),
        {"$set": update_data},
        return_document=True,
    )
    return stringify_object_ids(result) if result else None


async def delete_event(event_id) -> bool:
    """
    Delete an event.
    """
    collection = get_events_collection()
    result = await collection.delete_one(_id_query(event_id))
    return result.deleted_count > 0


async def update_event_state(event_id, state: EventState) -> Optional[dict]:
    """
    Update event state.
    """
    collection = get_events_collection()
    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {"$set": {"state": state}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def get_joined_events(user_id) -> list[dict]:
    """
    Get events where the user is an APPROVED participant.
    """
    db = get_database()
    participants_collection = db["participants"]
    events_collection = db["events"]
    
    # Find approved participations for this user
    participations = await participants_collection.find({
        "user_id": str(user_id),
        "status": "approved"
    }).to_list(length=100)
    
    # event_id stored are now stringified _id values
    event_ids = []
    for p in participations:
        eid = p["event_id"]
        if ObjectId.is_valid(eid):
            event_ids.append(ObjectId(eid))
        else:
            event_ids.append(eid)
    
    if not event_ids:
        return []
        
    cursor = events_collection.find({"_id": {"$in": event_ids}})
    events = await cursor.to_list(length=100)
    return stringify_object_ids(events)
