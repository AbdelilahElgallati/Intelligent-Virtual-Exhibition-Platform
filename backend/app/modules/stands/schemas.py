"""
Stand schemas for IVEP.

Defines data models for exhibition stands.
"""

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class StandBase(BaseModel):
    """Base schema for stand data."""
    
    id: str = Field(alias="_id")
    slug: Optional[str] = None
    event_id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"  # standard, premium, sponsor
    category: Optional[str] = None
    theme_color: Optional[str] = "#1e293b"
    stand_background_url: Optional[str] = None
    presenter_avatar_bg: Optional[str] = "#ffffff"
    presenter_name: Optional[str] = None
    presenter_avatar_url: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}

    @field_validator("theme_color", "presenter_avatar_bg", mode="before")
    @classmethod
    def validate_hex_color(cls, v):
        if v is not None and not re.match(r'^#(?:[0-9a-fA-F]{3}){1,2}$', str(v)):
            raise ValueError("Must be a valid hex color code (e.g., #FF5733)")
        return v


class StandCreate(BaseModel):
    """Schema for creating a stand."""
    
    organization_id: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"
    category: Optional[str] = None
    theme_color: Optional[str] = "#1e293b"
    stand_background_url: Optional[str] = None
    presenter_avatar_bg: Optional[str] = "#ffffff"
    presenter_name: Optional[str] = None
    presenter_avatar_url: Optional[str] = None
    
    model_config = {"from_attributes": True}


class StandRead(BaseModel):
    """Schema for reading stand data."""
    
    id: str = Field(alias="_id")
    slug: Optional[str] = None
    event_id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = []
    stand_type: Optional[str] = "standard"
    category: Optional[str] = None
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
    banner_url: Optional[str] = None
    tags: Optional[list[str]] = None
    stand_type: Optional[str] = None
    category: Optional[str] = None
    theme_color: Optional[str] = None
    stand_background_url: Optional[str] = None
    presenter_avatar_bg: Optional[str] = None
    presenter_name: Optional[str] = None
    presenter_avatar_url: Optional[str] = None
    
    model_config = {"from_attributes": True}
