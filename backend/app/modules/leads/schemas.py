from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class LeadInteraction(BaseModel):
    visitor_id: str
    stand_id: str
    interaction_type: str # visit, resource_download, chat, meeting
    metadata: Dict[str, str] = {}
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class LeadSchema(BaseModel):
    id: str = Field(alias="_id")
    visitor_id: str
    stand_id: str
    visitor_name: str
    email: str
    score: int = 0
    tags: List[str] = []
    last_interaction: datetime
    interactions_count: int = 0
    
    class Config:
        populate_by_name = True

class ConnectionRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    status: str = "pending" # pending, accepted, ignored
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
