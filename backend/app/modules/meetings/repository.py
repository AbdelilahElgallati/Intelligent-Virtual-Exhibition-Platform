from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from ...db.mongo import get_database
from .schemas import MeetingCreate, MeetingUpdate, MeetingSchema

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
        return doc

    async def get_visitor_meetings(self, visitor_id: str) -> List[dict]:
        cursor = self.collection.find({"visitor_id": visitor_id})
        meetings = await cursor.to_list(length=100)
        for m in meetings:
            m["_id"] = str(m["_id"])
        return meetings

    async def get_stand_meetings(self, stand_id: str) -> List[dict]:
        cursor = self.collection.find({"stand_id": stand_id})
        meetings = await cursor.to_list(length=100)
        for m in meetings:
            m["_id"] = str(m["_id"])
        return meetings

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
