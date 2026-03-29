import asyncio
from app.db.mongo import connect_to_mongo, get_database
from app.core.config import settings

async def check():
    await connect_to_mongo()
    db = get_database()
    participants = await db.participants.find({'status': 'approved'}).to_list(length=100)
    for p in participants:
        print(f"keys={list(p.keys())}")
        print(f"status={p.get('status')} user_id={p.get('user_id')} org_id={p.get('organization_id')} enterprise_id={p.get('enterprise_id')}")
        print("---")

asyncio.run(check())
