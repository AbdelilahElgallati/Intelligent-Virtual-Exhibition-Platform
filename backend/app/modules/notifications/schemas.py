"""
Notification schemas for IVEP.

Defines data models for user notifications.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class NotificationType(str, Enum):
    """Types of notifications used when creating new entries."""

    EVENT_APPROVED = "event_approved"
    INVITATION_SENT = "invitation_sent"
    PARTICIPANT_ACCEPTED = "participant_accepted"


class NotificationBase(BaseModel):
    """Base schema for notification data."""
    
    id: str = Field(alias="_id")
    user_id: str
    type: str
    message: str
    is_read: bool
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class NotificationRead(BaseModel):
    """Schema for reading notification data."""
    
    id: str = Field(alias="_id")
    user_id: str
    type: str
    message: str
    is_read: bool
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}
