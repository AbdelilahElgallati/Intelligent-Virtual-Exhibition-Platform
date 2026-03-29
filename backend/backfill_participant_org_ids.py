import asyncio
from bson import ObjectId
from app.db.mongo import connect_to_mongo, get_database

async def backfill():
    await connect_to_mongo()
    db = get_database()

    # Print first 3 organization_members docs for debug
    print("First 3 organization_members docs:")
    first3 = await db.organization_members.find().to_list(length=3)
    for doc in first3:
        print(doc)

    participants = await db.participants.find({
        "$or": [
            {"organization_id": {"$exists": False}},
            {"organization_id": None}
        ],
        "status": "approved"
    }).to_list(length=1000)
    updated = 0
    skipped = 0
    for p in participants:
        user_id = p.get("user_id")
        if not user_id:
            skipped += 1
            continue
        # Try both string and ObjectId for user_id
        query = {"$or": [
            {"user_id": str(user_id)},
            {"user_id": ObjectId(user_id)} if ObjectId.is_valid(str(user_id)) else {"user_id": "__never__"}
        ]}
        member_doc = await db.organization_members.find_one(query)
        org_id = str(member_doc["organization_id"]) if member_doc and member_doc.get("organization_id") else None
        if org_id:
            res = await db.participants.update_one({"_id": p["_id"]}, {"$set": {"organization_id": org_id}})
            if res.modified_count:
                updated += 1
        else:
            skipped += 1
            print(f"Skipped participant _id={p['_id']} user_id={user_id} (no org match)")
    print(f"Updated {updated} participant records with organization_id. Skipped {skipped}.")

if __name__ == "__main__":
    asyncio.run(backfill())
