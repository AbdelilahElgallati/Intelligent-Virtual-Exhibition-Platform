"""
Stand schemas for IVEP.

Defines data models for exhibition stands.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StandBase(BaseModel):
    """Base schema for stand data."""
    
    id: str = Field(alias="_id")
    event_id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"  # standard, premium, sponsor
    theme_color: Optional[str] = "#1e293b"
    stand_background_url: Optional[str] = None
    presenter_avatar_bg: Optional[str] = "#ffffff"
    presenter_name: Optional[str] = None
    presenter_avatar_url: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class StandCreate(BaseModel):
    """Schema for creating a stand."""
    
    organization_id: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"
    theme_color: Optional[str] = "#1e293b"
    stand_background_url: Optional[str] = None
    presenter_avatar_bg: Optional[str] = "#ffffff"
    presenter_name: Optional[str] = None
    presenter_avatar_url: Optional[str] = None
    
    model_config = {"from_attributes": True}


class StandRead(BaseModel):
    """Schema for reading stand data."""
    
    id: str = Field(alias="_id")
    event_id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"
    theme_color: Optional[str] = "#1e293b"
    stand_background_url: Optional[str] = None
    presenter_avatar_bg: Optional[str] = "#ffffff"
    presenter_name: Optional[str] = None
    presenter_avatar_url: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class StandUpdate(BaseModel):
    """Schema for updating stand data."""
    
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    tags: Optional[list[str]] = None
    stand_type: Optional[str] = None
    theme_color: Optional[str] = None
    stand_background_url: Optional[str] = None
    presenter_avatar_bg: Optional[str] = None
    presenter_name: Optional[str] = None
    presenter_avatar_url: Optional[str] = None
    
    model_config = {"from_attributes": True}
