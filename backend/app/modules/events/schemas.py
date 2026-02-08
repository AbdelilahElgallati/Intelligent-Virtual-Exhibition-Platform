"""
Event schemas for IVEP.

Defines data models for events and event lifecycle states.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class EventState(str, Enum):
    """Event lifecycle states."""
    
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    LIVE = "live"
    CLOSED = "closed"


class EventBase(BaseModel):
    """Base schema for event data."""
    
    id: UUID
    title: str
    description: Optional[str] = None
    organizer_id: UUID
    state: EventState
    created_at: datetime
    
    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    """Schema for creating a new event."""
    
    title: str
    description: Optional[str] = None
    
    model_config = {"from_attributes": True}


class EventUpdate(BaseModel):
    """Schema for updating an event."""
    
    title: Optional[str] = None
    description: Optional[str] = None
    
    model_config = {"from_attributes": True}


class EventRead(BaseModel):
    """Schema for reading event data."""
    
    id: UUID
    title: str
    description: Optional[str] = None
    organizer_id: UUID
    state: EventState
    created_at: datetime
    
    model_config = {"from_attributes": True}
