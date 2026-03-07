from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    stream: bool = True

class IngestRequest(BaseModel):
    source_url: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[dict] = None

class AssistantMessage(BaseModel):
    role: str # user, assistant
    content: str
    timestamp: datetime = datetime.utcnow()

class SessionResponse(BaseModel):
    session_id: str
    messages: List[AssistantMessage]
    created_at: datetime
