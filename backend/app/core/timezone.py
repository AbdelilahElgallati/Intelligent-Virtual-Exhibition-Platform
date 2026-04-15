"""
Timezone service for IVEP.
Centralizes UTC conversion, localization, and status computation logic.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Union, Tuple
from zoneinfo import ZoneInfo
import json

class TimezoneService:
    @staticmethod
    def to_aware_utc(dt: Union[datetime, str, None], tz_name: str = "UTC") -> Optional[datetime]:
        """
        Converts a datetime (aware or naive) or ISO string to an aware UTC datetime.
        If naive, localizes it using tz_name before converting to UTC.
        """
        if dt is None:
            return None
        
        if isinstance(dt, str):
            try:
                # Handle 'Z' suffix for UTC
                dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except ValueError:
                return None

        if dt.tzinfo is None:
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = timezone.utc
            return dt.replace(tzinfo=tz).astimezone(timezone.utc)
        
        return dt.astimezone(timezone.utc)

    @staticmethod
    def get_now_utc() -> datetime:
        """Returns the current aware UTC datetime."""
        return datetime.now(timezone.utc)

    @classmethod
    def is_event_live(cls, event: dict, now: Optional[datetime] = None) -> bool:
        """
        Computes if an event is live based on its state, dates, and schedule.
        """
        if now is None:
            now = cls.get_now_utc()

        state = str(event.get("state") or "").lower()
        if state == "closed":
            return False
        if state not in ("live", "payment_done", "approved"):
            return False

        # If explicit state is 'live', we check the timeline
        # If it's 'approved' or 'payment_done', it might be 'live' by dates but not yet transitioned
        # However, for access control, we usually want to be strict.
        
        start_date = cls.to_aware_utc(event.get("start_date"))
        end_date = cls.to_aware_utc(event.get("end_date"))

        # Check schedule slots if present
        schedule_days = event.get("schedule_days")
        if not schedule_days and event.get("event_timeline"):
            try:
                parsed = json.loads(event["event_timeline"])
                if isinstance(parsed, list):
                    schedule_days = parsed
            except Exception:
                pass

        if schedule_days and isinstance(schedule_days, list) and start_date:
            tz_name = str(event.get("event_timezone") or "UTC")
            try:
                event_tz = ZoneInfo(tz_name)
            except Exception:
                event_tz = timezone.utc

            # Correct way to get the local base date for Day 1
            base_local_date = start_date.astimezone(event_tz).date()
            
            for idx, day in enumerate(schedule_days):
                day_num = int(day.get("day_number") or (idx + 1))
                day_offset = max(0, day_num - 1)
                day_date = base_local_date + timedelta(days=day_offset)

                for slot in day.get("slots") or []:
                    start_min = cls._parse_hhmm(slot.get("start_time"))
                    end_min = cls._parse_hhmm(slot.get("end_time"))
                    if start_min is None or end_min is None or start_min == end_min:
                        continue

                    # Local start/end
                    slot_start_local = datetime.combine(day_date, datetime.min.time(), tzinfo=event_tz) + timedelta(minutes=start_min)
                    
                    end_day_offset = 1 if end_min <= start_min else 0
                    slot_end_local = datetime.combine(day_date, datetime.min.time(), tzinfo=event_tz) + timedelta(days=end_day_offset, minutes=end_min)
                    
                    slot_start = slot_start_local.astimezone(timezone.utc)
                    slot_end = slot_end_local.astimezone(timezone.utc)
                    
                    if slot_start <= now <= slot_end:
                        return True
            
            # If we have schedule days but none are active, the event is not 'live' in the schedule.
            # But maybe we want to allow entry if it's within the broad start/end window?
            # Typically, schedule is the source of truth for "Live View".
            return False

        # Fallback to broad dates
        if start_date and end_date:
            # Fix single-day event midnight boundary
            if start_date.date() == end_date.date() and end_date.time() == datetime.min.time():
                end_date = end_date + timedelta(days=1)
            return start_date <= now <= end_date

        return False

    @staticmethod
    def _parse_hhmm(value: Optional[str]) -> Optional[int]:
        if not value or ":" not in value:
            return None
        try:
            h, m = map(int, value.split(":", 1))
            if 0 <= h <= 23 and 0 <= m <= 59:
                return h * 60 + m
        except Exception:
            pass
        return None

timezone_service = TimezoneService()
