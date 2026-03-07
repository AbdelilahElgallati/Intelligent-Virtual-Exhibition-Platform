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

    async def create_message(self, message_data: dict) -> MessageSchema:
        result = await self.messages.insert_one(message_data)
        message_data["_id"] = result.inserted_id
        return MessageSchema(**message_data)

    async def get_room_messages(self, room_id: str, limit: int = 50, skip: int = 0) -> List[MessageSchema]:
        cursor = self.messages.find({"room_id": room_id}).sort("timestamp", -1).skip(skip).limit(limit)
        messages = await cursor.to_list(length=limit)
        return [MessageSchema(**msg) for msg in messages]

    async def get_or_create_direct_room(self, user1_id: str, user2_id: str) -> ChatRoomSchema:
        # Check if room exists
        room = await self.rooms.find_one({
            "type": "direct",
            "members": {"$all": [user1_id, user2_id]}
        })
        
        if room:
            return ChatRoomSchema(**room)
        
        # Create new room
        new_room = {
            "type": "direct",
            "members": [user1_id, user2_id],
            "created_at": ObjectId().generation_time
        }
        result = await self.rooms.insert_one(new_room)
        new_room["_id"] = result.inserted_id
        return ChatRoomSchema(**new_room)

    async def get_user_rooms(self, user_id: str) -> List[ChatRoomSchema]:
        cursor = self.rooms.find({"members": user_id}).sort("created_at", -1)
        rooms = await cursor.to_list(length=100)
        return [ChatRoomSchema(**room) for room in rooms]

chat_repo = ChatRepository()
