"""
Event schemas for IVEP.

Defines data models for events and event lifecycle states.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import AliasChoices, BaseModel, Field, field_validator


class EventState(str, Enum):
    """Event lifecycle states."""

    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    WAITING_FOR_PAYMENT = "waiting_for_payment"
    PAYMENT_DONE = "payment_done"
    LIVE = "live"
    CLOSED = "closed"


class EventBase(BaseModel):
    """Base schema for event data."""

    id: str = Field(validation_alias=AliasChoices("_id", "id"))
    title: str
    description: Optional[str] = None
    organizer_id: str
    state: EventState

    @field_validator("state", mode="before")
    @classmethod
    def coerce_legacy_state(cls, v: str) -> str:
        """Map legacy 'draft' state to 'pending_approval'."""
        if v == "draft":
            return "pending_approval"
        return v
    banner_url: Optional[str] = None
    category: Optional[str] = "Exhibition"
    start_date: datetime
    end_date: datetime
    location: Optional[str] = "Virtual Platform"
    tags: list[str] = []
    organizer_name: Optional[str] = None
    created_at: datetime

    # Request-specific fields
    num_enterprises: Optional[int] = None
    event_timeline: Optional[str] = None
    extended_details: Optional[str] = None
    additional_info: Optional[str] = None

    # Payment & access links (set by admin on approval/payment)
    payment_amount: Optional[float] = None
    enterprise_link: Optional[str] = None
    visitor_link: Optional[str] = None
    rejection_reason: Optional[str] = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class EventCreate(BaseModel):
    """Schema for submitting a new event request (goes straight to PENDING_APPROVAL)."""

    title: str
    description: Optional[str] = None
    category: Optional[str] = "Exhibition"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = "Virtual Platform"
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = []
    organizer_name: Optional[str] = None

    # Required request fields
    num_enterprises: int = Field(..., ge=1, description="Number of participating enterprises")
    event_timeline: str = Field(..., min_length=10, description="Precise event timeline / schedule")
    extended_details: str = Field(..., min_length=10, description="Extended event details")
    additional_info: Optional[str] = None

    model_config = {"from_attributes": True}


class EventUpdate(BaseModel):
    """Schema for updating a pending event request (organizer only, before approval)."""

    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = None
    organizer_name: Optional[str] = None
    num_enterprises: Optional[int] = None
    event_timeline: Optional[str] = None
    extended_details: Optional[str] = None
    additional_info: Optional[str] = None

    model_config = {"from_attributes": True}


class EventApproveRequest(BaseModel):
    """Schema for admin approving an event (sets payment amount)."""

    payment_amount: Optional[float] = Field(
        None,
        ge=0,
        description="Override payment amount. If omitted, auto-calculated from enterprises × days.",
    )


class EventRejectRequest(BaseModel):
    """Schema for admin rejecting an event request."""

    reason: Optional[str] = None


class EventRead(EventBase):
    """Schema for reading event data."""
    pass


class EventsResponse(BaseModel):
    """Schema for wrapped events list response."""

    events: list[EventRead]
    total: int

    model_config = {"from_attributes": True}
