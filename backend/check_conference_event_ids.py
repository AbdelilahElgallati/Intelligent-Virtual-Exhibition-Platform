
import asyncio
from app.db.mongo import get_database, connect_to_mongo
from bson import ObjectId
from app.modules.events.service import resolve_event_id


async def check():
    await connect_to_mongo()
    db = get_database()
    # Find all conferences
    confs = await db.conferences.find({}).to_list(length=100)
    for c in confs:
        print(f"title={c.get('title')} event_id={c.get('event_id')} status={c.get('status')}")
    # Also find the fintech event
    event = await db.events.find_one({'slug': 'fintech-world-forum-e1df'})
    if event:
        print(f"FinTech event _id={event['_id']}")

    # Check by ObjectId
    event_by_id = await db.events.find_one({'_id': ObjectId('69c7101011ad45af3e57e1df')})
    if event_by_id:
        print(f'FinTech slug field = {event_by_id.get("slug")}')
        print(f'FinTech all fields = {list(event_by_id.keys())}')

    # Test resolve_event_id directly
    resolved = await resolve_event_id('fintech-world-forum-e1df')
    print(f'resolve_event_id result = {resolved}')

if __name__ == "__main__":
    asyncio.run(check())
// file removed
