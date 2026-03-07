from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class MeetingStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELED = "canceled"
    COMPLETED = "completed"

class MeetingBase(BaseModel):
    visitor_id: str
    stand_id: str
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None

class MeetingCreate(MeetingBase):
    pass

class MeetingUpdate(BaseModel):
    status: MeetingStatus
    notes: Optional[str] = None

class MeetingSchema(MeetingBase):
    id: str = Field(alias="_id")
    status: MeetingStatus = MeetingStatus.PENDING
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True

class AvailabilitySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    is_available: bool = True
