import asyncio
from app.db.mongo import get_database
from bson import ObjectId

async def check():
    db = get_database()
    user = await db.users.find_one({"email": "enterprise1@demo.com"})
    if not user:
        print("User enterprise1@demo.com not found")
        return
    print(f"User ID: {user['_id']}")
    
    member = await db.organization_members.find_one({"user_id": str(user['_id'])})
    if not member:
        print("Member not found in organization_members")
        return
    org_id = member['organization_id']
    print(f"Org ID: {org_id}")
    
    stand = await db.stands.find_one({"organization_id": str(org_id)})
    if not stand:
        print("Stand not found for this organization")
    else:
        print(f"Stand ID: {stand['_id']}")
        meetings_count = await db.meetings.count_documents({"stand_id": str(stand['_id'])})
        print(f"Meetings for stand {stand['_id']}: {meetings_count}")
        
    participants = await db.participants.find({"organization_id": str(org_id)}).to_list(100)
    print(f"Found {len(participants)} participant records for this org")
    for p in participants:
        print(f"  Event: {p.get('event_id')}, Role: {p.get('role')}, Status: {p.get('status')}")

if __name__ == "__main__":
    asyncio.run(check())
