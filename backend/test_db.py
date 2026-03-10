import asyncio
import json
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['ivep_db']
    
    parts = await db.participants.find({"status": "approved"}).to_list(100)
    print("Approved Participants:", len(parts))
    for p in parts:
        if p.get("role", "").lower() == "enterprise":
            print(f"Enterprise Part: _id={p['_id']} user_id={p.get('user_id')} org_id={p.get('organization_id')}")
            
    orgs = await db.organizations.find().to_list(100)
    print("\nOrganizations:", len(orgs))
    for o in orgs:
        print(f"Org: _id={o['_id']} owner_id={o.get('owner_id')} name={o.get('name')}")
        
    users = await db.users.find().to_list(100)
    for u in users:
        if str(u["_id"]) in [str(p.get("user_id")) for p in parts]:
            print(f"User: _id={u['_id']} role={u.get('role')} name={u.get('full_name')} email={u.get('email')}")

asyncio.run(main())
