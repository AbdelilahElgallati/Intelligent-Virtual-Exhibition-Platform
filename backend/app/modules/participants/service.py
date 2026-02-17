"""
Participant service for IVEP.

Provides MongoDB-backed participant storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.participants.schemas import ParticipantStatus
from app.db.utils import stringify_object_ids

def get_participants_collection() -> AsyncIOMotorCollection:
    """Get the participants collection from MongoDB."""
    db = get_database()
    return db["participants"]

async def invite_participant(event_id, user_id) -> dict:
    """
    Invite a user to an event.
    """
    participant_id = uuid4()
    now = datetime.now(timezone.utc)
    
    participant = {
        "id": str(participant_id),
        "event_id": str(event_id),
        "user_id": str(user_id),
        "status": ParticipantStatus.INVITED,
        "created_at": now,
    }
    
    collection = get_participants_collection()
    await collection.insert_one(participant)
    return stringify_object_ids(participant)

async def request_to_join(event_id, user_id) -> dict:
    """
    Request to join an event.
    """
    participant_id = uuid4()
    now = datetime.now(timezone.utc)
    
    participant = {
        "id": str(participant_id),
        "event_id": str(event_id),
        "user_id": str(user_id),
        "status": ParticipantStatus.REQUESTED,
        "created_at": now,
    }
    
    collection = get_participants_collection()
    await collection.insert_one(participant)
    return stringify_object_ids(participant)

async def get_participant_by_id(participant_id) -> Optional[dict]:
    """Get participant by ID."""
    collection = get_participants_collection()
    doc = await collection.find_one({"id": str(participant_id)})
    return stringify_object_ids(doc) if doc else None

async def get_user_participation(event_id, user_id) -> Optional[dict]:
    """Get participant record for a specific user and event."""
    collection = get_participants_collection()
    doc = await collection.find_one({
        "event_id": str(event_id),
        "user_id": str(user_id)
    })
    return stringify_object_ids(doc) if doc else None

async def list_event_participants(event_id) -> List[dict]:
    """List all participants for an event."""
    collection = get_participants_collection()
    cursor = collection.find({"event_id": str(event_id)})
    docs = await cursor.to_list(length=1000)
    return stringify_object_ids(docs)

async def approve_participant(participant_id) -> Optional[dict]:
    """
    Approve a participant.
    """
    collection = get_participants_collection()
    updated = await collection.find_one_and_update(
        {"id": str(participant_id)},
        {"$set": {"status": ParticipantStatus.APPROVED}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None

async def reject_participant(participant_id) -> Optional[dict]:
    """
    Reject a participant.
    """
    collection = get_participants_collection()
    updated = await collection.find_one_and_update(
        {"id": str(participant_id)},
        {"$set": {"status": ParticipantStatus.REJECTED}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None
