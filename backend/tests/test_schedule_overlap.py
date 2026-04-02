import pytest
from datetime import datetime, timezone
from app.modules.events.schemas import ScheduleDay, ScheduleSlot, validate_schedule_consistency

def test_valid_normal_schedule():
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="09:00", end_time="10:00", label="Slot 1"),
            ScheduleSlot(start_time="10:00", end_time="11:00", label="Slot 2")
        ])
    ]
    # Should not raise
    validate_schedule_consistency(days)

def test_internal_overlap():
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="09:00", end_time="10:30", label="Slot 1"),
            ScheduleSlot(start_time="10:00", end_time="11:00", label="Slot 2")
        ])
    ]
    with pytest.raises(ValueError, match="Overlap on Day 1"):
        validate_schedule_consistency(days)

def test_valid_cross_day():
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="22:00", end_time="01:30", label="Night Slot")
        ]),
        ScheduleDay(day_number=2, slots=[
            ScheduleSlot(start_time="02:00", end_time="03:00", label="Late Night")
        ])
    ]
    # Should not raise. Day 1 ends at 01:30 (next day), Day 2 starts at 02:00.
    validate_schedule_consistency(days)

def test_invalid_cross_day_overlap():
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="22:00", end_time="01:30", label="Night Slot")
        ]),
        ScheduleDay(day_number=2, slots=[
            ScheduleSlot(start_time="01:00", end_time="02:00", label="Morning Slot")
        ])
    ]
    with pytest.raises(ValueError, match="overlaps with Day 1 overflow"):
        validate_schedule_consistency(days)

def test_multi_day_gap_resets_overflow():
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="22:00", end_time="01:30", label="Night Slot")
        ]),
        ScheduleDay(day_number=3, slots=[
            ScheduleSlot(start_time="01:00", end_time="02:00", label="Morning Slot")
        ])
    ]
    # Gap (Day 2 missing) should reset overflow (though logically it might still be active if it was a 2-day session, but our logic handles 1-day spill)
    validate_schedule_consistency(days)

def test_zero_duration_slot():
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="09:00", end_time="09:00", label="Zero")
        ])
    ]
    with pytest.raises(ValueError, match="has zero duration"):
        validate_schedule_consistency(days)

def test_global_boundary_before():
    # Event starts at 10:00. Day 1 slot at 09:00 should fail.
    start = datetime(2025, 1, 1, 10, 0, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, 10, 0, tzinfo=timezone.utc)
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="09:00", end_time="11:00", label="Early")
        ])
    ]
    with pytest.raises(ValueError, match="before the official event start"):
        validate_schedule_consistency(days, event_start=start, event_end=end)

def test_global_boundary_after():
    # Event ends at 15:00. Day 2 (Jan 2) slot at 16:00 should fail.
    start = datetime(2025, 1, 1, 10, 0, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, 15, 0, tzinfo=timezone.utc)
    days = [
        ScheduleDay(day_number=2, slots=[
            ScheduleSlot(start_time="16:00", end_time="17:00", label="Too Late")
        ])
    ]
    with pytest.raises(ValueError, match="after the event closure"):
        validate_schedule_consistency(days, event_start=start, event_end=end)

def test_day_1_early_morning_slot_invalid():
    # Event starts at 20:00 on March 27.
    # A slot at 00:07 on THE SAME DAY is chronologically BEFORE the event.
    start = datetime(2026, 3, 27, 20, 0, tzinfo=timezone.utc)
    end = datetime(2026, 3, 28, 20, 0, tzinfo=timezone.utc)
    days = [
        ScheduleDay(day_number=1, slots=[
            ScheduleSlot(start_time="00:07", end_time="03:00", label="Early Morning Improperly on Day 1")
        ])
    ]
    with pytest.raises(ValueError, match="before the official event start"):
        validate_schedule_consistency(days, event_start=start, event_end=end)
