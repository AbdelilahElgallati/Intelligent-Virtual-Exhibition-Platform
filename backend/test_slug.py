
import asyncio
import sys
import os

# Allow importing from the app package
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app.db.mongo import connect_to_mongo
from app.modules.events.service import get_event_by_id
from app.core.config import settings

async def test_resolution():
    await connect_to_mongo()
    slug = "morocco-ai-innovation-grand-expo-2026-c391"
    print(f"Testing resolution for slug: {slug}")
    event = await get_event_by_id(slug)
    if event:
        print(f"SUCCESS: Found event '{event['title']}' with ID {event['id']}")
    else:
        print("FAILURE: Event not found by slug")
        
    # Test by ID too
    eid = "69c40c6e9d5abd9fd4a6c391"
    print(f"\nTesting resolution for ID: {eid}")
    event = await get_event_by_id(eid)
    if event:
        print(f"SUCCESS: Found event '{event['title']}' with ID {event['id']}")
    else:
        print("FAILURE: Event not found by ID")

if __name__ == "__main__":
    asyncio.run(test_resolution())
