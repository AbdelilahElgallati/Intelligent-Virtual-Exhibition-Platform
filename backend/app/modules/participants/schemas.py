"""
Participant schemas for IVEP.

Defines data models for event participants.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class ParticipantStatus(str, Enum):
    """Participant status in an event."""
    
    INVITED = "invited"
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"


class ParticipantBase(BaseModel):
    """Base schema for participant data."""
    
    id: UUID
    event_id: UUID
    user_id: UUID
    status: ParticipantStatus
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ParticipantRead(BaseModel):
    """Schema for reading participant data."""
    
    id: UUID
    event_id: UUID
    user_id: UUID
    status: ParticipantStatus
    created_at: datetime
    
    model_config = {"from_attributes": True}
