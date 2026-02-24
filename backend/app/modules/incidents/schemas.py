"""
Incidents schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class IncidentSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    MITIGATING = "mitigating"
    RESOLVED = "resolved"


class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: IncidentSeverity = IncidentSeverity.MEDIUM


class IncidentUpdate(BaseModel):
    status: Optional[IncidentStatus] = None
    notes: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[IncidentSeverity] = None


class IncidentRead(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    severity: IncidentSeverity
    status: IncidentStatus
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContentFlagCreate(BaseModel):
    entity_type: str       # "event", "stand", "user", "organization"
    entity_id: str
    reason: str
    details: Optional[str] = None


class ContentFlagRead(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    reason: str
    details: Optional[str]
    created_at: datetime
    reporter_id: Optional[str] = None

    model_config = {"from_attributes": True}
