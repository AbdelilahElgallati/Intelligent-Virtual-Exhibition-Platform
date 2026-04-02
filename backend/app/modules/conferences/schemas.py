"""
Conference schemas for IVEP.

Conferences are created by organizers and assigned to enterprises to host.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ConferenceStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"
    CANCELED = "canceled"


class ConferenceCreate(BaseModel):
    """Used by organizer to create and assign a conference to an enterprise."""
    title: str
    slug: Optional[str] = None                  # Human-readable identifier
    description: Optional[str] = None
    speaker_name: Optional[str] = None         # Display name for the speaker
    assigned_enterprise_id: str                 # Enterprise user _id who will host
    event_id: str                               # Required: must belong to an event
    stand_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    max_attendees: int = 0                      # 0 = unlimited
    chat_enabled: bool = True
    qa_enabled: bool = True


class ConferenceUpdate(BaseModel):
    """Organizer can update any field."""
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    speaker_name: Optional[str] = None
    assigned_enterprise_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    max_attendees: Optional[int] = None
    chat_enabled: Optional[bool] = None
    qa_enabled: Optional[bool] = None


class ConferenceRead(BaseModel):
    id: str = Field(alias="_id")
    title: str
    slug: str = ""
    description: Optional[str] = None
    speaker_name: Optional[str] = None
    assigned_enterprise_id: str
    assigned_enterprise_name: Optional[str] = None   # enriched
    organizer_id: str
    event_id: str                                    # required — always set
    stand_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: ConferenceStatus = ConferenceStatus.SCHEDULED
    room_name: Optional[str] = None  # was: livekit_room_name
    max_attendees: int = 0
    attendee_count: int = 0
    is_registered: Optional[bool] = None            # populated per-user at runtime
    chat_enabled: bool = True
    qa_enabled: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}


class ConferenceTokenResponse(BaseModel):
    token: str
    room_url: str         # Full Daily room URL (https://<domain>/<room_name>)
    room_name: str
    role: str   # "speaker" | "audience"


# ── Q&A ───────────────────────────────────────────────────────────────────────

class QACreate(BaseModel):
    question: str


class QAAnswer(BaseModel):
    answer: str


class QARead(BaseModel):
    id: str = Field(alias="_id")
    conference_id: str
    user_id: str
    user_name: str
    question: str
    is_answered: bool = False
    answer: Optional[str] = None
    upvotes: int = 0
    created_at: datetime

    model_config = {"populate_by_name": True}
