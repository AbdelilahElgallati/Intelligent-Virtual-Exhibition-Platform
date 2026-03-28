import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def test_summary():
    from app.db.mongo import connect_to_mongo, get_database
    from app.modules.organizer_report.service import get_organizer_summary
    
    await connect_to_mongo()
    db = get_database()
    
    # Get a random event
    event = await db["events"].find_one({}, {"_id": 1, "slug": 1, "title": 1})
    if not event:
        print("No events found in DB to test.")
        return

    event_id = str(event["_id"])
    print(f"Testing summary for event: {event.get('slug')} (ID: {event_id})")
    
    summary = await get_organizer_summary(event_id)
    print("Summary generated successfully.")
    print(f"Event ID in summary: {summary.event_id}")
    print(f"Event Slug in summary: {summary.event_slug}")
    print(f"Event Title in summary: {summary.event_title}")
    
    assert summary.event_id == event_id
    assert summary.event_slug == event.get("slug")
    assert summary.event_title == event.get("title")
    
    print("Verification PASSED!")

if __name__ == "__main__":
    asyncio.run(test_summary())
