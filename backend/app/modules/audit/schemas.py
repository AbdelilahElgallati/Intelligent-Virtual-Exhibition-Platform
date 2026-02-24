"""
Audit log schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from datetime import datetime


class AuditLogCreate(BaseModel):
    actor_id: str
    action: str                    # e.g. "event.approve", "user.suspend"
    entity: str                    # e.g. "event", "user", "organization"
    entity_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AuditLogRead(BaseModel):
    id: str
    actor_id: str
    action: str
    entity: str
    entity_id: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}
