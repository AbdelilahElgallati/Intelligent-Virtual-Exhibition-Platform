"""
Pydantic schemas for event_sessions collection.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"


# ─── Request bodies ───────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: str
    speaker: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def start_before_end(self) -> "SessionCreate":
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        return self


# ─── Response ─────────────────────────────────────────────────────────────────

class SessionRead(BaseModel):
    id: str
    event_id: str
    title: str
    speaker: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: SessionStatus
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
