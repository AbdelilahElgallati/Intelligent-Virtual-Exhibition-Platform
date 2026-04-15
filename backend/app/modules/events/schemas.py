"""
Event schemas for IVEP.

Defines data models for events and event lifecycle states.
"""

from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Optional, Union, cast
from zoneinfo import ZoneInfo
from app.core.timezone import timezone_service

from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator, ValidationInfo


def _parse_time_to_minutes(t_str: str) -> int:
    """Convert HH:MM to minutes from midnight."""
    h, m = map(int, t_str.split(":"))
    return h * 60 + m


def validate_schedule_consistency(
    schedule_days: Optional[list["ScheduleDay"]],
    event_start: Optional[datetime] = None,
    event_end: Optional[datetime] = None,
    event_timezone: Optional[str] = None,
) -> Optional[list["ScheduleDay"]]:
    """
    Ensure no slots overlap, including cross-day spills, and fit within event boundaries.
    """
    if not schedule_days:
        return schedule_days

    # Sort by day number just in case
    sorted_days = sorted(schedule_days, key=lambda d: d.day_number)
    
    # Track "blocked" minutes from previous day's overflow
    overflow_minutes = 0
    previous_day = -1
    
    # Base date for Day 1 (midnight of event_start in event_timezone)
    base_date: Optional[datetime] = None
    if event_start and event_timezone:
        import pytz
        tz = pytz.timezone(event_timezone)
        if event_start.tzinfo is not None:
            event_start = event_start.astimezone(tz).replace(tzinfo=None)
        base_date = event_start.replace(hour=0, minute=0, second=0, microsecond=0)
    elif event_start:
        base_date = event_start.replace(hour=0, minute=0, second=0, microsecond=0)

    import pytz
    for day in sorted_days:
        if previous_day != -1 and day.day_number > previous_day + 1:
            # Gaps between days reset overflow
            overflow_minutes = 0
        
        day_date: Optional[datetime] = None
        if base_date is not None:
            # Type narrowing for linter
            base_dt: datetime = cast(datetime, base_date)
            day_date = base_dt + timedelta(days=day.day_number - 1)

        slots_to_validate = []
        for slot in day.slots:
            start = _parse_time_to_minutes(slot.start_time)
            end = _parse_time_to_minutes(slot.end_time)
            is_cross_day = end < start
            actual_end = end + 1440 if is_cross_day else end
            
            # Global boundary checks
            if day_date is not None:
                the_day: datetime = cast(datetime, day_date)
                abs_start: datetime = the_day + timedelta(minutes=start)
                abs_end: datetime = the_day + timedelta(minutes=actual_end)

                # Ensure all datetimes are timezone-aware before comparison
                if event_timezone:
                    tz = pytz.timezone(event_timezone)
                    if abs_start.tzinfo is None:
                        abs_start = tz.localize(abs_start)
                    if abs_end.tzinfo is None:
                        abs_end = tz.localize(abs_end)

                # IMPORTANT: If a slot starts before the event, it belongs to the previous day 
                # or is simply invalid.
                if event_start is not None:
                    ev_start: datetime = cast(datetime, event_start)
                    if event_timezone and ev_start.tzinfo is None:
                        tz = pytz.timezone(event_timezone)
                        ev_start = tz.localize(ev_start)
                    if abs_start < ev_start:
                        raise ValueError(
                            f"Slot '{slot.label}' on Day {day.day_number} starts at {slot.start_time}, "
                            f"which is before the official event start ({ev_start.strftime('%d %b %H:%M')}). "
                            "Please move this slot to the correct day."
                        )
                if event_end is not None:
                    ev_end: datetime = cast(datetime, event_end)
                    if event_timezone and ev_end.tzinfo is None:
                        tz = pytz.timezone(event_timezone)
                        ev_end = tz.localize(ev_end)
                    if abs_end > ev_end:
                        raise ValueError(
                            f"Slot '{slot.label}' on Day {day.day_number} ends at "
                            f"{_format_minutes(actual_end)}, which is after the event closure "
                            f"({ev_end.strftime('%d %b %H:%M')})."
                        )

            slots_to_validate.append({
                "start": start,
                "end": actual_end,
                "label": slot.label,
                "is_cross": is_cross_day,
                "raw": slot
            })

        # Sort slots by chronological start time
        slots_to_validate.sort(key=lambda s: s["start"])

        # 1. Overlap with previous day's overflow
        if overflow_minutes > 0:
            for s in slots_to_validate:
                if s["start"] < overflow_minutes:
                    raise ValueError(
                        f"Day {day.day_number} slot '{s['label']}' ({_format_minutes(s['start'])}) overlaps with "
                        f"Day {previous_day} overflow (until {_format_minutes(overflow_minutes)})"
                    )

        # 2. Overlap between slots in the same day
        for i in range(len(slots_to_validate)):
            current = slots_to_validate[i]
            if current["start"] == current["end"]:
                 raise ValueError(f"Slot '{current['label']}' has zero duration")

            if i + 1 < len(slots_to_validate):
                nxt = slots_to_validate[i+1]
                if current["end"] > nxt["start"]:
                    raise ValueError(
                        f"Overlap on Day {day.day_number}: '{current['label']}' ends at "
                        f"{_format_minutes(current['end'])} but '{nxt['label']}' starts at "
                        f"{_format_minutes(nxt['start'])}"
                    )

        # Calculate overflow for next day (only cross-day slots contribute)
        day_overflow = 0
        for s in slots_to_validate:
            if s["is_cross"]:
                # If we sorted by start, and there's no overlap, then the last cross-day 
                # slot is the one that overflows.
                day_overflow = max(day_overflow, s["end"] - 1440)
        
        overflow_minutes = day_overflow
        previous_day = day.day_number

    return schedule_days


def _format_minutes(m: int) -> str:
    """Format minutes (potentially > 1440) back to HH:MM."""
    over_days = m // 1440
    rem = m % 1440
    h = rem // 60
    mm = rem % 60
    return f"{h:02d}:{mm:02d}" + (f" (+{over_days}d)" if over_days > 0 else "")


# ── Schedule sub-models ─────────────────────────────────────────────────────

class ScheduleSlot(BaseModel):
    """A single time-block within a schedule day (free-form hours)."""
    start_time: str   # "HH:MM" — e.g. "09:00"
    end_time:   str   # "HH:MM" — e.g. "17:00"
    label:      str = ""  # activity description
    # Conference fields (optional)
    is_conference: bool = False
    assigned_enterprise_id: Optional[str] = None
    assigned_enterprise_name: Optional[str] = None
    speaker_name: Optional[str] = None
    conference_id: Optional[str] = None


class ScheduleDay(BaseModel):
    """One day in the structured event schedule."""
    day_number:  int
    date_label:  Optional[str] = None
    slots:       list[ScheduleSlot] = []



class EventState(str, Enum):
    """Event lifecycle states."""

    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    WAITING_FOR_PAYMENT = "waiting_for_payment"
    PAYMENT_PROOF_SUBMITTED = "payment_proof_submitted"
    PAYMENT_DONE = "payment_done"
    LIVE = "live"
    CLOSED = "closed"


class EventBase(BaseModel):
    """Base schema for event data."""

    id: str = Field(validation_alias=AliasChoices("_id", "id"))
    slug: Optional[str] = None
    title: str
    description: Optional[str] = None
    organizer_id: str
    state: EventState
    
    @field_validator("start_date", "end_date", mode="after")
    @classmethod
    def ensure_utc(cls, v: datetime) -> datetime:
        """Force awareness and convert to UTC for consistent JSON serialization (Z suffix)."""
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)

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
    event_timezone: str = "UTC"
    location: Optional[str] = "Virtual Platform"
    tags: list[str] = []
    organizer_name: Optional[str] = None
    created_at: datetime

    # Request-specific fields
    num_enterprises: Optional[int] = None
    event_timeline: Optional[str] = None      # legacy free-text OR serialised JSON
    schedule_days: Optional[list[ScheduleDay]] = None  # structured schedule
    extended_details: Optional[str] = None
    additional_info: Optional[str] = None

    # Pricing fields (set by organizer at request time)
    stand_price: Optional[float] = None       # amount enterprise pays per stand
    is_paid: bool = False                      # is the event paid for visitors?
    ticket_price: Optional[float] = None      # visitor ticket price (only when is_paid)

    # Payment & access links (set by admin on approval/payment)
    payment_amount: Optional[float] = None
    rib_code: Optional[str] = None
    payment_proof_url: Optional[str] = None
    enterprise_link: Optional[str] = None
    visitor_link: Optional[str] = None
    publicity_link: Optional[str] = None
    rejection_reason: Optional[str] = None

    model_config = {"from_attributes": True, "populate_by_name": True}

    @field_validator("event_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except Exception as exc:
            raise ValueError("Invalid IANA timezone") from exc
        return value


class EventCreate(BaseModel):
    """Schema for submitting a new event request (goes straight to PENDING_APPROVAL)."""

    title: str
    description: Optional[str] = None
    category: Optional[str] = "Exhibition"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    event_timezone: str = "UTC"
    location: Optional[str] = "Virtual Platform"
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = []
    organizer_name: Optional[str] = None

    # Required request fields
    num_enterprises: int = Field(..., ge=1, description="Number of participating enterprises")
    event_timeline: str = Field(..., min_length=1, description="JSON schedule or free-text timeline")
    schedule_days: Optional[list[ScheduleDay]] = None
    extended_details: str = Field(..., min_length=10, description="Extended event details")
    additional_info: Optional[str] = None

    # Pricing fields
    stand_price: float = Field(..., ge=0, description="Amount an enterprise pays to host a stand")
    is_paid: bool = Field(False, description="Whether the event requires visitor ticket payment")
    ticket_price: Optional[float] = Field(None, ge=0, description="Visitor ticket price (required when is_paid=True)")

    @model_validator(mode="after")
    def ensure_utc_dates(self) -> "EventCreate":
        tz = self.event_timezone or "UTC"
        if self.start_date:
            self.start_date = timezone_service.to_aware_utc(self.start_date, tz)
        if self.end_date:
            self.end_date = timezone_service.to_aware_utc(self.end_date, tz)
        return self

    @model_validator(mode="after")
    def validate_schedule_boundaries(self) -> "EventCreate":
        validate_schedule_consistency(
            self.schedule_days,
            event_start=self.start_date,
            event_end=self.end_date,
            event_timezone=self.event_timezone,
        )
        return self

    model_config = {"from_attributes": True}

    @field_validator("event_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except Exception as exc:
            raise ValueError("Invalid IANA timezone") from exc
        return value


class EventUpdate(BaseModel):
    """Schema for updating a pending event request (organizer only, before approval)."""

    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    event_timezone: Optional[str] = None
    location: Optional[str] = None
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = None
    organizer_name: Optional[str] = None
    num_enterprises: Optional[int] = None
    event_timeline: Optional[str] = None
    schedule_days: Optional[list[ScheduleDay]] = None
    extended_details: Optional[str] = None
    additional_info: Optional[str] = None
    stand_price: Optional[float] = None
    is_paid: Optional[bool] = None
    ticket_price: Optional[float] = None
    slug: Optional[str] = None

    @model_validator(mode="after")
    def ensure_utc_dates(self) -> "EventUpdate":
        tz = self.event_timezone or "UTC"
        if self.start_date:
            self.start_date = timezone_service.to_aware_utc(self.start_date, tz)
        if self.end_date:
            self.end_date = timezone_service.to_aware_utc(self.end_date, tz)
        return self

    @model_validator(mode="after")
    def validate_schedule_boundaries(self) -> "EventUpdate":
        validate_schedule_consistency(
            self.schedule_days,
            event_start=self.start_date,
            event_end=self.end_date,
            event_timezone=self.event_timezone,
        )
        return self

    model_config = {"from_attributes": True}

    @field_validator("event_timezone")
    @classmethod
    def validate_timezone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except Exception as exc:
            raise ValueError("Invalid IANA timezone") from exc
        return value


class ScheduleSlotConferenceAssign(BaseModel):
    """Payload to assign/unassign a conference on a specific schedule slot."""
    day_index: int = Field(..., ge=0)
    slot_index: int = Field(..., ge=0)
    is_conference: bool = False
    assigned_enterprise_id: Optional[str] = None
    speaker_name: Optional[str] = None
    title: Optional[str] = None  # conference title (defaults to slot label)


class EventApproveRequest(BaseModel):
    """Schema for admin approving an event (sets payment amount)."""

    payment_amount: float = Field(
        ...,
        ge=0,
        description="Required payment amount set by admin.",
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
