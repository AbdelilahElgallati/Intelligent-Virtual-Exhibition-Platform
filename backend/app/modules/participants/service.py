"""
Participant service for IVEP.

Provides MongoDB-backed participant storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4
from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.participants.schemas import ParticipantStatus

def get_participants_collection() -> AsyncIOMotorCollection:
    """Get the participants collection from MongoDB."""
    db = get_database()
    return db["participants"]

async def invite_participant(event_id: UUID, user_id: UUID) -> dict:
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
    return participant

async def request_to_join(event_id: UUID, user_id: UUID) -> dict:
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
    return participant

async def get_participant_by_id(participant_id: UUID) -> Optional[dict]:
    """Get participant by ID."""
    collection = get_participants_collection()
    return await collection.find_one({"id": str(participant_id)})

async def get_user_participation(event_id: UUID, user_id: UUID) -> Optional[dict]:
    """Get participant record for a specific user and event."""
    collection = get_participants_collection()
    return await collection.find_one({
        "event_id": str(event_id),
        "user_id": str(user_id)
    })

async def list_event_participants(event_id: UUID) -> List[dict]:
    """List all participants for an event."""
    collection = get_participants_collection()
    cursor = collection.find({"event_id": str(event_id)})
    return await cursor.to_list(length=1000)

async def approve_participant(participant_id: UUID) -> Optional[dict]:
    """
    Approve a participant.
    """
    collection = get_participants_collection()
    return await collection.find_one_and_update(
        {"id": str(participant_id)},
        {"$set": {"status": ParticipantStatus.APPROVED}},
        return_document=True
    )

async def reject_participant(participant_id: UUID) -> Optional[dict]:
    """
    Reject a participant.
    """
    collection = get_participants_collection()
    return await collection.find_one_and_update(
        {"id": str(participant_id)},
        {"$set": {"status": ParticipantStatus.REJECTED}},
        return_document=True
    )
