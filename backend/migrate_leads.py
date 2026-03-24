from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os

async def migrate():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["ivep"] # Standard database name for the project
    
    # 1. Get all leads missing last_interaction_type
    leads_cursor = db.leads.find({"last_interaction_type": {"$exists": False}})
    leads = await leads_cursor.to_list(length=None)
    
    print(f"Found {len(leads)} leads to migrate.")
    
    for lead in leads:
        # Find the latest interaction for this visitor and stand
        latest_interaction = await db.lead_interactions.find_one(
            {"visitor_id": lead["visitor_id"], "stand_id": lead["stand_id"]},
            sort=[("timestamp", -1)]
        )
        
        if latest_interaction:
            type_val = latest_interaction.get("interaction_type", "stand_visit")
            await db.leads.update_one(
                {"_id": lead["_id"]},
                {"$set": {"last_interaction_type": type_val}}
            )
            print(f"Updated lead {lead['_id']} with type {type_val}")
        else:
            # Default to stand_visit if no interaction record is found
            await db.leads.update_one(
                {"_id": lead["_id"]},
                {"$set": {"last_interaction_type": "stand_visit"}}
            )
            print(f"Updated lead {lead['_id']} with default type stand_visit")

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
