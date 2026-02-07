from bson import ObjectId
from typing import List, Optional
from datetime import datetime
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
        await self.interactions.insert_one(interaction.model_dump())
        
        # Update or create lead entry
        # In a real app, we'd fetch actual visitor info
        await self.leads.update_one(
            {"visitor_id": interaction.visitor_id, "stand_id": interaction.stand_id},
            {
                "$inc": {"interactions_count": 1, "score": 10},
                "$set": {"last_interaction": datetime.utcnow()},
                "$setOnInsert": {
                    "visitor_name": f"Visitor {interaction.visitor_id[-4:]}",
                    "email": f"user_{interaction.visitor_id[-4:]}@example.com",
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
