"""
Stand schemas for IVEP.

Defines data models for exhibition stands.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class StandBase(BaseModel):
    """Base schema for stand data."""
    
    id: UUID
    event_id: UUID
    organization_id: UUID
    name: str
    created_at: datetime
    
    model_config = {"from_attributes": True}


class StandCreate(BaseModel):
    """Schema for creating a stand."""
    
    organization_id: UUID
    name: str
    
    model_config = {"from_attributes": True}


class StandRead(BaseModel):
    """Schema for reading stand data."""
    
    id: UUID
    event_id: UUID
    organization_id: UUID
    name: str
    created_at: datetime
    
    model_config = {"from_attributes": True}
