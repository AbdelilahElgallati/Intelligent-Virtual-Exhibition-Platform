import sys
from datetime import datetime, timezone
from pydantic import ValidationError

# Mock the environment to avoid relative import errors
sys.path.append('d:/My_Projects/Intelligent-Virtual-Exhibition-Platform/backend')

try:
    from app.modules.events.schemas import EventRead, EventState
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

# Legacy "invalid" data: slot starts before event start
legacy_data = {
    "_id": "test_id",
    "slug": "test_slug",
    "title": "Test Event",
    "organizer_id": "test_org",
    "state": "pending_approval",
    "start_date": datetime(2026, 3, 26, 23, 0, tzinfo=timezone.utc), # 26 Mar 23:00
    "end_date": datetime(2026, 3, 28, 23, 0, tzinfo=timezone.utc),
    "created_at": datetime.now(timezone.utc),
    "schedule_days": [
        {
            "day_number": 1,
            "slots": [
                {
                    "start_time": "20:20", # BEFORE event start (23:00)
                    "end_time": "21:20",
                    "label": "Opening ceremony & keynotes"
                }
            ]
        }
    ]
}

print("Attempting to instantiate EventRead with legacy data...")
try:
    event = EventRead(**legacy_data)
    print("SUCCESS: EventRead instantiated successfully. Validation is lenient.")
except ValidationError as e:
    print("FAILURE: EventRead still enforces strict validation!")
    print(e)
except Exception as e:
    print(f"Unexpected error: {e}")
