"""
Analytics schemas for IVEP.

Defines data models for event logging.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AnalyticsEventType(str, Enum):
    """Types of analytics events."""
    
    EVENT_VIEW = "event_view"
    STAND_VISIT = "stand_visit"
    CHAT_OPENED = "chat_opened"


class AnalyticsEventBase(BaseModel):
    """Base schema for analytics data."""
    
    type: AnalyticsEventType
    user_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    stand_id: Optional[UUID] = None
    
    model_config = {"from_attributes": True}


class AnalyticsEventCreate(AnalyticsEventBase):
    """Schema for creating an analytics event."""
    pass


class AnalyticsEventRead(AnalyticsEventBase):
    """Schema for reading analytics data."""
    
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}
