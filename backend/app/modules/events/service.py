"""
Event service for IVEP.

Provides in-memory event storage and CRUD operations.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.events.schemas import EventCreate, EventState, EventUpdate


def get_events_collection() -> AsyncIOMotorCollection:
    """Get the events collection from MongoDB."""
    db = get_database()
    return db["events"]


async def create_event(data: EventCreate, organizer_id: UUID) -> dict:
    """
    Create a new event in DRAFT state.
    """
    event_id = uuid4()
    now = datetime.now(timezone.utc)
    
    # extra fields for frontend
    event = {
        "id": str(event_id),
        "title": data.title,
        "description": data.description,
        "organizer_id": str(organizer_id),
        "state": EventState.DRAFT,
        "banner_url": None,
        "category": "Exhibition",
        "start_date": now,
        "end_date": now,
        "location": "Virtual Platform",
        "tags": [],
        "organizer_name": "Organizer User", # Mock
        "created_at": now,
    }
    
    collection = get_events_collection()
    await collection.insert_one(event)
    return event


async def get_event_by_id(event_id: UUID) -> Optional[dict]:
    """
    Get event by ID.
    """
    collection = get_events_collection()
    return await collection.find_one({"id": str(event_id)})


# async def list_events(organizer_id: Optional[UUID] = None, state: Optional[EventState] = None) -> list[dict]:
#     """
#     List all events with optional filters.
#     """
#     collection = get_events_collection()
#     query = {}
    
#     if organizer_id:
#         query["organizer_id"] = str(organizer_id)
    
#     if state:
#         query["state"] = state
    
#     cursor = collection.find(query)
#     return await cursor.to_list(length=100)

async def list_events(
    organizer_id: Optional[UUID] = None, 
    state: Optional[EventState] = None,
    category: Optional[str] = None,  # Add this
    search: Optional[str] = None     # Add this
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

    # Implement filtering logic for the new parameters
    if category:
        query["category"] = category

    if search:
        # Simple case-insensitive regex search on title or description
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = collection.find(query)
    return await cursor.to_list(length=100)


async def update_event(event_id: UUID, data: EventUpdate) -> Optional[dict]:
    """
    Update an event.
    """
    collection = get_events_collection()
    update_data = {}
    
    if data.title is not None:
        update_data["title"] = data.title
    if data.description is not None:
        update_data["description"] = data.description
    
    if not update_data:
        return await get_event_by_id(event_id)
    
    result = await collection.find_one_and_update(
        {"id": str(event_id)},
        {"$set": update_data},
        return_document=True
    )
    return result


async def delete_event(event_id: UUID) -> bool:
    """
    Delete an event.
    """
    collection = get_events_collection()
    result = await collection.delete_one({"id": str(event_id)})
    return result.deleted_count > 0


async def update_event_state(event_id: UUID, state: EventState) -> Optional[dict]:
    """
    Update event state.
    """
    collection = get_events_collection()
    return await collection.find_one_and_update(
        {"id": str(event_id)},
        {"$set": {"state": state}},
        return_document=True
    )


async def get_joined_events(user_id: UUID) -> list[dict]:
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
    
    event_ids = [p["event_id"] for p in participations]
    
    if not event_ids:
        return []
        
    cursor = events_collection.find({"id": {"$in": event_ids}})
    return await cursor.to_list(length=100)
