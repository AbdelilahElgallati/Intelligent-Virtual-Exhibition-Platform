from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from ...db.mongo import get_database
from .schemas import MeetingCreate, MeetingUpdate, MeetingSchema
from ..auth.enums import Role
from ..leads.repository import lead_repo
from ..leads.schemas import LeadInteraction

class MeetingRepository:
    @property
    def db(self):
        return get_database()

    @property
    def collection(self):
        return self.db.meetings

    async def create_meeting(self, meeting_data: MeetingCreate) -> dict:
        doc = meeting_data.model_dump()
        doc["status"] = "pending"
        doc["created_at"] = datetime.utcnow()
        doc["updated_at"] = datetime.utcnow()
        result = await self.collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)

        # Log lead interaction
        try:
            await lead_repo.log_interaction(LeadInteraction(
                visitor_id=doc["visitor_id"],
                stand_id=doc["stand_id"],
                interaction_type="meeting",
                metadata={"purpose": doc.get("purpose")}
            ))
        except Exception:
            pass

        return doc

    async def get_visitor_meetings(self, visitor_id: str) -> List[dict]:
        cursor = self.collection.find({"visitor_id": visitor_id})
        meetings = await cursor.to_list(length=100)
        
        enriched = []
        for m in meetings:
            m["_id"] = str(m["_id"])
            
            # Fetch receiver organization name (the stand owner)
            stand_id = m.get("stand_id")
            if stand_id:
                stand = await self.db.stands.find_one({"_id": ObjectId(stand_id) if ObjectId.is_valid(stand_id) else stand_id})
                if stand:
                    org = await self.db.organizations.find_one({"_id": ObjectId(stand["organization_id"]) if ObjectId.is_valid(stand["organization_id"]) else stand["organization_id"]})
                    if org:
                        m["receiver_org_name"] = org.get("name")
            
            enriched.append(m)
        return enriched

    async def get_stand_meetings(self, stand_id: str) -> List[dict]:
        cursor = self.collection.find({"stand_id": str(stand_id)})
        meetings = await cursor.to_list(length=100)
        
        enriched = []
        for m in meetings:
            m["_id"] = str(m["_id"])
            
            # Fetch requester (visitor or enterprise user)
            user_id = m.get("visitor_id")
            if user_id:
                user = await self.db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
                if user:
                    m["requester_name"] = user.get("full_name") or user.get("email")
                    m["requester_role"] = user.get("role")
                    
                    # If enterprise, find organization
                    if str(m.get("requester_role")).lower() == Role.ENTERPRISE.value:
                        member = await self.db.organization_members.find_one({"user_id": str(user_id)})
                        if member:
                            org = await self.db.organizations.find_one({"_id": ObjectId(member["organization_id"]) if ObjectId.is_valid(member["organization_id"]) else member["organization_id"]})
                            if org:
                                m["requester_org_name"] = org.get("name")
            
            enriched.append(m)
        return enriched

    async def update_meeting_status(self, meeting_id: str, update: MeetingUpdate) -> Optional[dict]:
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "status": update.status,
                "notes": update.notes,
                "updated_at": datetime.utcnow()
            }},
            return_document=True
        )
        if result:
            result["_id"] = str(result["_id"])
        return result

meeting_repo = MeetingRepository()
