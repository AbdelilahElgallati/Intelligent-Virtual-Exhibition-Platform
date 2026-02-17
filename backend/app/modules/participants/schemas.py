"""
Participant schemas for IVEP.

Defines data models for event participants.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ParticipantStatus(str, Enum):
    """Participant status in an event."""
    
    INVITED = "invited"
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"


class ParticipantBase(BaseModel):
    """Base schema for participant data."""
    
    id: str = Field(alias="_id")
    event_id: str
    user_id: str
    status: ParticipantStatus
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class ParticipantRead(BaseModel):
    """Schema for reading participant data."""
    
    id: str = Field(alias="_id")
    event_id: str
    user_id: str
    status: ParticipantStatus
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}
