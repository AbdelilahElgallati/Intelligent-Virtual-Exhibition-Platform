from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

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
