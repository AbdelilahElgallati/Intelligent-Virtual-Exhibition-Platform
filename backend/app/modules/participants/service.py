"""
Participant service for IVEP.

Provides in-memory participant storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from app.modules.participants.schemas import ParticipantStatus


# In-memory participant store
PARTICIPANTS_STORE: dict[UUID, dict] = {}


def invite_participant(event_id: UUID, user_id: UUID) -> dict:
    """
    Invite a user to an event.
    
    Args:
        event_id: Event ID.
        user_id: User ID to invite.
        
    Returns:
        dict: Created participant data.
    """
    participant_id = uuid4()
    now = datetime.now(timezone.utc)
    
    participant = {
        "id": participant_id,
        "event_id": event_id,
        "user_id": user_id,
        "status": ParticipantStatus.INVITED,
        "created_at": now,
    }
    
    PARTICIPANTS_STORE[participant_id] = participant
    return participant


def request_to_join(event_id: UUID, user_id: UUID) -> dict:
    """
    Request to join an event.
    
    Args:
        event_id: Event ID.
        user_id: User ID requesting to join.
        
    Returns:
        dict: Created participant data.
    """
    participant_id = uuid4()
    now = datetime.now(timezone.utc)
    
    participant = {
        "id": participant_id,
        "event_id": event_id,
        "user_id": user_id,
        "status": ParticipantStatus.REQUESTED,
        "created_at": now,
    }
    
    PARTICIPANTS_STORE[participant_id] = participant
    return participant


def get_participant_by_id(participant_id: UUID) -> Optional[dict]:
    """Get participant by ID."""
    return PARTICIPANTS_STORE.get(participant_id)


def approve_participant(participant_id: UUID) -> Optional[dict]:
    """
    Approve a participant.
    
    Args:
        participant_id: Participant ID.
        
    Returns:
        dict: Updated participant or None.
    """
    participant = PARTICIPANTS_STORE.get(participant_id)
    if participant is None:
        return None
    
    participant["status"] = ParticipantStatus.APPROVED
    return participant


def reject_participant(participant_id: UUID) -> Optional[dict]:
    """
    Reject a participant.
    
    Args:
        participant_id: Participant ID.
        
    Returns:
        dict: Updated participant or None.
    """
    participant = PARTICIPANTS_STORE.get(participant_id)
    if participant is None:
        return None
    
    participant["status"] = ParticipantStatus.REJECTED
    return participant


def list_event_participants(event_id: UUID, status: Optional[ParticipantStatus] = None) -> list[dict]:
    """
    List participants for an event.
    
    Args:
        event_id: Event ID.
        status: Optional status filter.
        
    Returns:
        list[dict]: List of participants.
    """
    participants = [p for p in PARTICIPANTS_STORE.values() if p["event_id"] == event_id]
    
    if status:
        participants = [p for p in participants if p["status"] == status]
    
    return participants


def get_user_participation(event_id: UUID, user_id: UUID) -> Optional[dict]:
    """Check if user already has a participation record for an event."""
    for p in PARTICIPANTS_STORE.values():
        if p["event_id"] == event_id and p["user_id"] == user_id:
            return p
    return None
