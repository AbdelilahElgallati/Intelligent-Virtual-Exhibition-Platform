"""
Notification schemas for IVEP.

Defines data models for user notifications.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class NotificationType(str, Enum):
    """Types of notifications."""
    
    EVENT_APPROVED = "event_approved"
    INVITATION_SENT = "invitation_sent"
    PARTICIPANT_ACCEPTED = "participant_accepted"


class NotificationBase(BaseModel):
    """Base schema for notification data."""
    
    id: UUID
    user_id: UUID
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}


class NotificationRead(BaseModel):
    """Schema for reading notification data."""
    
    id: UUID
    user_id: UUID
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}
