from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timezone
from ...db.mongo import get_database
from .schemas import MeetingCreate, MeetingUpdate, MeetingSchema
from ..auth.enums import Role
from ..leads.service import lead_service
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
        doc["session_status"] = "scheduled"
        doc["created_at"] = datetime.now(timezone.utc)
        doc["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)

        # Auto-assign livekit_room_name based on new _id
        room_name = f"meeting-{doc['_id']}"
        await self.collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"livekit_room_name": room_name}}
        )
        doc["livekit_room_name"] = room_name

        # Log lead interaction
        try:
            await lead_service.log_interaction(LeadInteraction(
                visitor_id=doc["visitor_id"],
                stand_id=doc["stand_id"],
                interaction_type="meeting",
                metadata={"purpose": doc.get("purpose")}
            ))
        except Exception:
            pass

        return doc

    async def get_meeting_by_id(self, meeting_id: str) -> Optional[dict]:
        """Fetch a single meeting by _id."""
        if not ObjectId.is_valid(meeting_id):
            return None
        doc = await self.collection.find_one({"_id": ObjectId(meeting_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def start_session(self, meeting_id: str) -> Optional[dict]:
        """Mark meeting as live."""
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"session_status": "live", "updated_at": datetime.now(timezone.utc)}},
            return_document=True
        )
        if result:
            result["_id"] = str(result["_id"])
        return result

    async def end_session(self, meeting_id: str) -> Optional[dict]:
        """Mark meeting as ended."""
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"session_status": "ended", "status": "completed", "updated_at": datetime.now(timezone.utc)}},
            return_document=True
        )
        if result:
            result["_id"] = str(result["_id"])
        return result

    async def auto_expire_past_meetings(self):
        """Auto-cancel pending meetings whose time window has passed."""
        now = datetime.now(timezone.utc)
        await self.collection.update_many(
            {
                "status": "pending",
                "end_time": {"$lt": now},
            },
            {"$set": {"status": "canceled", "updated_at": now}}
        )

    async def get_visitor_meetings(self, visitor_id: str) -> List[dict]:
        await self.auto_expire_past_meetings()
        cursor = self.collection.find({"visitor_id": visitor_id})
        meetings = await cursor.to_list(length=100)

        enriched = []
        for m in meetings:
            m["_id"] = str(m["_id"])

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
        await self.auto_expire_past_meetings()
        cursor = self.collection.find({"stand_id": str(stand_id)})
        meetings = await cursor.to_list(length=100)

        enriched = []
        for m in meetings:
            m["_id"] = str(m["_id"])

            user_id = m.get("visitor_id")
            if user_id:
                user = await self.db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
                if user:
                    m["requester_name"] = user.get("full_name") or user.get("email")
                    m["requester_role"] = user.get("role")

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
                "updated_at": datetime.now(timezone.utc)
            }},
            return_document=True
        )
        if result:
            result["_id"] = str(result["_id"])
        return result


    async def get_busy_slots(
        self,
        event_id: str,
        user_id: str,
        stand_id: str | None = None,
        statuses: list[str] | None = None,
    ) -> list[dict]:
        """
        Return all existing meetings (pending/approved) for a user or their stand in this event.
        Used for conflict detection when scheduling new meetings.
        """
        allowed_statuses = statuses or ["pending", "approved"]
        conditions = []

        # Meetings where this user is the requester
        conditions.append({"visitor_id": user_id, "event_id": event_id})

        # Meetings on this user's stand (inbound)
        if stand_id:
            conditions.append({"stand_id": stand_id, "event_id": event_id})

        cursor = self.collection.find({
            "$or": conditions,
            "status": {"$in": allowed_statuses},
        })
        meetings = await cursor.to_list(length=500)
        slots = []
        for m in meetings:
            slots.append({
                "start_time": m["start_time"],
                "end_time": m["end_time"],
                "type": "meeting",
                "label": m.get("purpose") or "Meeting",
            })
        return slots

    async def check_conflict(self, event_id: str, user_id: str, stand_id: str,
                             start_time: datetime, end_time: datetime) -> str | None:
        """
        Check if either participant has an overlapping meeting.
        Returns a conflict description string, or None if free.
        """
        # Check requester's meetings
        requester_conflict = await self.collection.find_one({
            "event_id": event_id,
            "visitor_id": user_id,
            "status": {"$in": ["pending", "approved"]},
            "start_time": {"$lt": end_time},
            "end_time": {"$gt": start_time},
        })
        if requester_conflict:
            return "You already have a meeting at this time"

        # Check target stand's meetings
        stand_conflict = await self.collection.find_one({
            "event_id": event_id,
            "stand_id": stand_id,
            "status": {"$in": ["pending", "approved"]},
            "start_time": {"$lt": end_time},
            "end_time": {"$gt": start_time},
        })
        if stand_conflict:
            return "The partner already has a meeting at this time"

        return None


meeting_repo = MeetingRepository()
