from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from typing import Any
from pydantic_core import core_schema

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: Any
    ) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.str_schema(),
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

class MessageSchema(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    room_id: str
    sender_id: str
    sender_name: str
    content: str
    type: str = "text" # text, image, file
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class ChatRoomSchema(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: Optional[str] = None
    type: str = "direct" # direct, group, stand
    members: List[str] # List of user_ids
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_message: Optional[dict] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class MessageCreate(BaseModel):
    room_id: str
    content: str
    type: str = "text"
