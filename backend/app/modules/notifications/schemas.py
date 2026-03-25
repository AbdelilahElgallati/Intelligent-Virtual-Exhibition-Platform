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
    EVENT_REJECTED = "event_rejected"
    PAYMENT_REQUIRED = "payment_required"
    PAYMENT_CONFIRMED = "payment_confirmed"
    LINKS_GENERATED = "links_generated"
    INVITATION_SENT = "invitation_sent"
    PARTICIPANT_ACCEPTED = "participant_accepted"
    PAYMENT_PROOF_SUBMITTED = "payment_proof_submitted"
    VISITOR_PAYMENT_APPROVED = "visitor_payment_approved"
    VISITOR_PAYMENT_REJECTED = "visitor_payment_rejected"
    # Conferences
    CONFERENCE_ASSIGNED = "conference_assigned"
    CONFERENCE_LIVE = "conference_live"
    MEETING_APPROVED = "meeting_approved"
    MEETING_REJECTED = "meeting_rejected"
    MARKETPLACE_ORDER_UPDATED = "marketplace_order_updated"
    MARKETPLACE_ORDER_CANCELLED = "marketplace_order_cancelled"



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
