from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from app.db.mongo import get_database
from app.modules.leads.repository import lead_repo
from app.modules.leads.schemas import LeadInteraction

class LeadService:
    async def log_interaction(self, interaction: LeadInteraction):
        """
        Centrally log an interaction and ensure the lead entry is enriched with real user data.
        """
        db = get_database()
        
        # 1. Fetch real user data to avoid hardcoded mock strings in repo
        visitor_id = str(interaction.visitor_id)
        user_doc = await db.users.find_one(
            {"_id": ObjectId(visitor_id)} if ObjectId.is_valid(visitor_id) else {"_id": visitor_id}
        )
        
        visitor_name = "Anonymous Visitor"
        visitor_email = "unknown@example.com"
        
        if user_doc:
            visitor_name = user_doc.get("full_name") or user_doc.get("username") or visitor_name
            visitor_email = user_doc.get("email") or visitor_email

        # 2. Add interaction to repository
        await lead_repo.log_interaction(interaction)
        
        # 3. Fixup the lead entry with real data (since repo uses $setOnInsert with mocks)
        stand_id = str(interaction.stand_id)
        await db.leads.update_one(
            {"visitor_id": visitor_id, "stand_id": stand_id},
            {
                "$set": {
                    "visitor_name": visitor_name,
                    "email": visitor_email,
                    "last_interaction": datetime.now(timezone.utc)
                }
            }
        )

lead_service = LeadService()
