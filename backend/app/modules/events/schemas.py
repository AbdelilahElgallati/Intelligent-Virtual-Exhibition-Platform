"""
Event schemas for IVEP.

Defines data models for events and event lifecycle states.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class EventState(str, Enum):
    """Event lifecycle states."""
    
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    LIVE = "live"
    CLOSED = "closed"


class EventBase(BaseModel):
    """Base schema for event data."""
    
    id: str = Field(alias="_id")
    title: str
    description: Optional[str] = None
    organizer_id: str
    state: EventState
    banner_url: Optional[str] = None
    category: Optional[str] = "Exhibition"
    start_date: datetime
    end_date: datetime
    location: Optional[str] = "Virtual Platform"
    tags: list[str] = []
    organizer_name: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}


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


class EventRead(EventBase):
    """Schema for reading event data."""
    pass


class EventsResponse(BaseModel):
    """Schema for wrapped events list response."""
    
    events: list[EventRead]
    total: int
    
    model_config = {"from_attributes": True}
