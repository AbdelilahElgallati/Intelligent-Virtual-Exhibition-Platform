import asyncio
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]
    
    # Find Abidine Ent's org
    org = await db.organizations.find_one({"name": {"$regex": "Abidine", "$options": "i"}})
    print(f"Org: {org.get('_id')} {org.get('name')}")
    
    # Find their participants
    participants = await db.participants.find({"organization_id": str(org["_id"])}).to_list(100)
    print(f"Participant records with org_id set: {len(participants)}")
    for p in participants:
        print(f"  event={p.get('event_id')} status={p.get('status')} org_id={p.get('organization_id')}")

asyncio.run(check())
