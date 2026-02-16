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
    description: Optional[str] = None
    logo_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"  # standard, premium, sponsor
    created_at: datetime
    
    model_config = {"from_attributes": True}


class StandCreate(BaseModel):
    """Schema for creating a stand."""
    
    organization_id: UUID
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"
    
    model_config = {"from_attributes": True}


class StandRead(BaseModel):
    """Schema for reading stand data."""
    
    id: UUID
    event_id: UUID
    organization_id: UUID
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"
    created_at: datetime
    
    model_config = {"from_attributes": True}
