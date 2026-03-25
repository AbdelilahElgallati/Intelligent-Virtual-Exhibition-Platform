from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone

class LeadInteraction(BaseModel):
    visitor_id: str
    stand_id: str
    interaction_type: str # visit, resource_download, chat, meeting
    metadata: Dict[str, str] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeadSchema(BaseModel):
    id: str = Field(alias="_id")
    visitor_id: str
    stand_id: str
    visitor_name: str
    email: str
    score: int = 0
    tags: List[str] = Field(default_factory=list)
    last_interaction: datetime
    last_interaction_type: Optional[str] = None
    interactions_count: int = 0
    
    class Config:
        populate_by_name = True

class ConnectionRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    status: str = "pending" # pending, accepted, ignored
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
