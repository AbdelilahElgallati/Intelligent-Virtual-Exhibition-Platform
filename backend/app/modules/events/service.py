"""
Event service for IVEP.

Provides MongoDB-backed event storage and CRUD operations.
"""

import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.events.schemas import EventCreate, EventState, EventUpdate
from app.db.utils import stringify_object_ids

# Price per enterprise per event day (configurable)
PRICE_PER_ENTERPRISE_PER_DAY: float = 50.0


def _id_query(eid) -> dict:
    """Build a query dict that matches _id (ObjectId or string)."""
    s = str(eid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_events_collection() -> AsyncIOMotorCollection:
    """Get the events collection from MongoDB."""
    db = get_database()
    return db["events"]


def _calculate_payment(num_enterprises: int, start_date: datetime, end_date: datetime) -> float:
    """Auto-calculate payment: enterprises × days × rate."""
    delta = end_date - start_date
    days = max(1, delta.days + (1 if delta.seconds > 0 else 0))
    return round(num_enterprises * days * PRICE_PER_ENTERPRISE_PER_DAY, 2)


async def create_event(data: EventCreate, organizer_id) -> dict:
    """
    Submit a new event request — goes directly to PENDING_APPROVAL state.
    """
    now = datetime.now(timezone.utc)

    event = {
        "title": data.title,
        "description": data.description,
        "organizer_id": str(organizer_id),
        "state": EventState.PENDING_APPROVAL,
        "banner_url": data.banner_url,
        "category": data.category or "Exhibition",
        "start_date": data.start_date or now,
        "end_date": data.end_date or now,
        "location": data.location or "Virtual Platform",
        "tags": data.tags or [],
        "organizer_name": data.organizer_name,
        "created_at": now,
        # New required request fields
        "num_enterprises": data.num_enterprises,
        "event_timeline": data.event_timeline,
        "extended_details": data.extended_details,
        "additional_info": data.additional_info,
        # Pricing fields (set by organizer)
        "stand_price": data.stand_price,
        "is_paid": data.is_paid,
        "ticket_price": data.ticket_price if data.is_paid else None,
        # Payment & links (set later)
        "payment_amount": None,
        "enterprise_link": None,
        "visitor_link": None,
        "rejection_reason": None,
        # Structured schedule
        "schedule_days": [d.model_dump() for d in data.schedule_days] if data.schedule_days else None,
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


async def approve_event(event_id, payment_amount: Optional[float] = None) -> Optional[dict]:
    """
    Approve event request → WAITING_FOR_PAYMENT.
    Auto-calculates payment if not provided.
    """
    collection = get_events_collection()
    event = await collection.find_one(_id_query(event_id))
    if not event:
        return None

    if payment_amount is None:
        payment_amount = _calculate_payment(
            event.get("num_enterprises", 1),
            event.get("start_date", datetime.now(timezone.utc)),
            event.get("end_date", datetime.now(timezone.utc)),
        )

    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {"$set": {"state": EventState.WAITING_FOR_PAYMENT, "payment_amount": payment_amount}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def reject_event(event_id, reason: Optional[str] = None) -> Optional[dict]:
    """
    Reject event request → REJECTED.
    """
    collection = get_events_collection()
    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {"$set": {"state": EventState.REJECTED, "rejection_reason": reason}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def confirm_event_payment(event_id) -> Optional[dict]:
    """
    Mark payment as done → PAYMENT_DONE.
    Generates unique enterprise and visitor access links.
    """
    collection = get_events_collection()
    enterprise_token = secrets.token_urlsafe(24)
    visitor_token = secrets.token_urlsafe(24)

    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {
            "$set": {
                "state": EventState.PAYMENT_DONE,
                "enterprise_link": f"/join/enterprise/{event_id}?token={enterprise_token}",
                "visitor_link": f"/join/visitor/{event_id}?token={visitor_token}",
            }
        },
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
