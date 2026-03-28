from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime, timezone
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

    @field_validator("start_time", "end_time", mode="after")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        """Force awareness and convert to UTC for consistent JSON serialization (Z suffix)."""
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)

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

    # Video session fields — provider-agnostic
    meeting_type: MeetingType = MeetingType.ONE_TO_ONE
    initiator_id: Optional[str] = None
    session_status: SessionStatus = SessionStatus.SCHEDULED
    room_name: Optional[str] = None  # was: livekit_room_name

    class Config:
        populate_by_name = True

class MeetingJoinResponse(BaseModel):
    """Returned when a meeting participant requests a Daily.co token."""
    token: str
    room_url: str         # Full Daily room URL (https://<domain>/<room_name>)
    room_name: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

class AvailabilitySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    is_available: bool = True

class BusySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    type: str          # "meeting" or "conference"
    label: str = ""    # e.g. meeting purpose or conference title
