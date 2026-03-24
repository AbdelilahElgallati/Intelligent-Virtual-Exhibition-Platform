from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timezone
from ...db.mongo import get_database
from .schemas import LeadInteraction, LeadSchema

class LeadRepository:
    @property
    def db(self):
        return get_database()

    @property
    def interactions(self):
        return self.db.lead_interactions

    @property
    def leads(self):
        return self.db.leads

    async def log_interaction(self, interaction: LeadInteraction):
        data = interaction.model_dump()
        # Ensure IDs are strings for consistent querying
        v_id = str(data["visitor_id"])
        s_id = str(data["stand_id"])
        data["visitor_id"] = v_id
        data["stand_id"] = s_id
        
        await self.interactions.insert_one(data)
        
        # Update or create lead entry
        await self.leads.update_one(
            {"visitor_id": v_id, "stand_id": s_id},
            {
                "$inc": {"interactions_count": 1, "score": 10},
                "$set": {
                    "last_interaction": datetime.now(timezone.utc),
                    "last_interaction_type": data.get("interaction_type")
                },
                "$setOnInsert": {
                    "visitor_name": f"Visitor {v_id[-4:]}",
                    "email": f"user_{v_id[-4:]}@example.com",
                    "tags": []
                }
            },
            upsert=True
        )

    async def get_stand_leads(self, stand_id: str) -> List[dict]:
        cursor = self.leads.find({"stand_id": stand_id}).sort("score", -1)
        leads = await cursor.to_list(length=100)
        for l in leads:
            l["_id"] = str(l["_id"])
        return leads

lead_repo = LeadRepository()
