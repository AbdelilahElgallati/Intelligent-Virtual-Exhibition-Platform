from typing import List, Optional
from bson import ObjectId
from .schemas import MessageSchema, ChatRoomSchema
from ...db.mongo import get_database

class ChatRepository:
    @property
    def db(self):
        return get_database()

    @property
    def messages(self):
        return self.db.chat_messages

    @property
    def rooms(self):
        return self.db.chat_rooms

    @staticmethod
    def _member_variants(user_id: str) -> list:
        variants = [str(user_id)]
        if ObjectId.is_valid(str(user_id)):
            variants.append(ObjectId(str(user_id)))
        return variants

    async def get_room_for_member(self, room_id: str, user_id: str) -> dict | None:
        query: dict = {"members": {"$in": self._member_variants(str(user_id))}}
        if ObjectId.is_valid(room_id):
            query["_id"] = ObjectId(room_id)
        else:
            query["id"] = room_id
        return await self.rooms.find_one(query)

    async def create_message(self, message_data: dict) -> MessageSchema:
        result = await self.messages.insert_one(message_data)
        message_data["_id"] = result.inserted_id
        room_query = {"_id": ObjectId(message_data["room_id"])} if ObjectId.is_valid(message_data["room_id"]) else {"id": message_data["room_id"]}
        await self.rooms.update_one(
            room_query,
            {
                "$set": {
                    "last_message": {
                        "_id": str(result.inserted_id),
                        "sender_id": message_data.get("sender_id"),
                        "sender_name": message_data.get("sender_name"),
                        "content": message_data.get("content"),
                        "type": message_data.get("type", "text"),
                        "timestamp": message_data.get("timestamp"),
                    },
                    "updated_at": message_data.get("timestamp"),
                }
            },
        )
        return MessageSchema(**message_data)

    async def get_room_messages(self, room_id: str, limit: int = 50, skip: int = 0) -> List[MessageSchema]:
        cursor = self.messages.find({"room_id": room_id}).sort("timestamp", -1).skip(skip).limit(limit)
        messages = await cursor.to_list(length=limit)
        return [MessageSchema(**msg) for msg in messages]

    async def get_or_create_direct_room(
        self, user1_id: str, user2_id: str,
        room_category: str = None, event_id: str = None
    ) -> ChatRoomSchema:
        user1_id = str(user1_id)
        user2_id = str(user2_id)
        user1_variants = self._member_variants(user1_id)
        user2_variants = self._member_variants(user2_id)

        # Build query — match members + category + event
        query: dict = {
            "type": "direct",
            "$and": [
                {"members": {"$in": user1_variants}},
                {"members": {"$in": user2_variants}},
                {"$expr": {"$eq": [{"$size": "$members"}, 2]}},
            ],
        }
        if room_category:
            query["room_category"] = room_category
        if event_id:
            query["event_id"] = event_id

        room = await self.rooms.find_one(query)
        if room:
            return ChatRoomSchema(**room)

        # Create new room with metadata
        new_room = {
            "type": "direct",
            "members": [user1_id, user2_id],
            "created_at": ObjectId().generation_time,
            "updated_at": ObjectId().generation_time,
            "room_category": room_category,
            "event_id": event_id,
            "last_message": None,
        }
        result = await self.rooms.insert_one(new_room)
        new_room["_id"] = result.inserted_id
        return ChatRoomSchema(**new_room)

    async def get_user_rooms(
        self, user_id: str,
        event_id: str = None, room_category: str = None
    ) -> List[ChatRoomSchema]:
        query: dict = {
            "members": {"$in": self._member_variants(str(user_id))},
            "last_message": {"$ne": None},
        }
        if event_id:
            query["event_id"] = event_id
        if room_category:
            query["room_category"] = room_category
        cursor = self.rooms.find(query).sort("updated_at", -1)
        rooms = await cursor.to_list(length=100)
        return [ChatRoomSchema(**room) for room in rooms]

chat_repo = ChatRepository()
