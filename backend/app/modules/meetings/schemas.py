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

class MeetingType(str, Enum):
    ONE_TO_ONE = "one_to_one"   # visitor ↔ enterprise
    B2B = "b2b"                  # enterprise ↔ enterprise

class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"

class MeetingBase(BaseModel):
    event_id: Optional[str] = None  # Every meeting should belong to an event, but allow legacy records
    visitor_id: str
    stand_id: str
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None

class MeetingCreate(MeetingBase):
    meeting_type: MeetingType = MeetingType.ONE_TO_ONE
    initiator_id: Optional[str] = None   # who is requesting the meeting

class MeetingUpdate(BaseModel):
    status: MeetingStatus
    notes: Optional[str] = None

class MeetingSchema(MeetingBase):
    id: str = Field(alias="_id")
    status: MeetingStatus = MeetingStatus.PENDING
    created_at: datetime
    updated_at: datetime

    # Enriched fields
    requester_name: Optional[str] = None
    requester_role: Optional[str] = None
    requester_org_name: Optional[str] = None
    receiver_org_name: Optional[str] = None

    # Video session fields (new)
    meeting_type: MeetingType = MeetingType.ONE_TO_ONE
    initiator_id: Optional[str] = None
    session_status: SessionStatus = SessionStatus.SCHEDULED
    livekit_room_name: Optional[str] = None

    class Config:
        populate_by_name = True

class MeetingJoinResponse(BaseModel):
    """Returned when a meeting participant requests a LiveKit token."""
    token: str
    livekit_url: str
    room_name: str

class AvailabilitySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    is_available: bool = True

class BusySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    type: str          # "meeting" or "conference"
    label: str = ""    # e.g. meeting purpose or conference title
