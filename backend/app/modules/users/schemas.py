"""
User schemas for IVEP.

Defines data models for user operations including profile and preferences.
"""

from datetime import datetime
from typing import Optional


from pydantic import BaseModel, EmailStr, Field

from app.modules.auth.enums import Role


# ── Profile sub-schemas (recommendation-ready) ──────────────────────

class ProfessionalInfo(BaseModel):
    """Professional information for visitor profile."""
    job_title: Optional[str] = None
    industry: Optional[str] = None
    company: Optional[str] = None
    experience_level: Optional[str] = None  # Junior / Mid / Senior / Executive


class EventPreferences(BaseModel):
    """Event preferences for visitor profile."""
    types: Optional[list[str]] = None       # Webinar / Exhibition / Networking / Workshop
    languages: Optional[list[str]] = None
    regions: Optional[list[str]] = None


class EngagementSettings(BaseModel):
    """Engagement/notification settings."""
    recommendations_enabled: bool = True
    email_notifications: bool = True


# ── Core user schemas ────────────────────────────────────────────────

class UserBase(BaseModel):
    """Base schema for user data."""
    
    id: str = Field(alias="_id")
    email: EmailStr
    username: str
    full_name: str
    role: Role
    is_active: bool = True
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    
    email: EmailStr
    username: str
    password: str
    full_name: str
    role: Role = Role.VISITOR
    
    model_config = {"from_attributes": True}


class UserRead(BaseModel):
    """Schema for reading user data (no password)."""
    
    id: str = Field(alias="_id")
    email: EmailStr
    username: Optional[str] = None  # Made optional for backward compatibility
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime

    # Profile fields (optional – backward compatible)
    bio: Optional[str] = None
    language: Optional[str] = None
    avatar_url: Optional[str] = None
    professional_info: Optional[ProfessionalInfo] = None
    interests: Optional[list[str]] = None
    event_preferences: Optional[EventPreferences] = None
    networking_goals: Optional[list[str]] = None
    engagement_settings: Optional[EngagementSettings] = None
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class UserUpdate(BaseModel):
    """Schema for updating user data."""
    
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    
    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    """Schema for visitor profile updates (More Informations section)."""

    full_name: Optional[str] = None
    bio: Optional[str] = None
    language: Optional[str] = None
    avatar_url: Optional[str] = None
    professional_info: Optional[ProfessionalInfo] = None
    interests: Optional[list[str]] = None
    event_preferences: Optional[EventPreferences] = None
    networking_goals: Optional[list[str]] = None
    engagement_settings: Optional[EngagementSettings] = None

    model_config = {"from_attributes": True}
