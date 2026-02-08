"""
Authentication schemas for IVEP.

Defines data models for authentication, authorization, and user roles.
"""

from enum import Enum

from pydantic import BaseModel, EmailStr


class Role(str, Enum):
    """User roles in the platform."""
    
    ADMIN = "admin"
    ORGANIZER = "organizer"
    ENTERPRISE = "enterprise"
    VISITOR = "visitor"


class LoginRequest(BaseModel):
    """Schema for user login request."""
    
    email: EmailStr
    password: str
    
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Schema for authentication token response."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    
    model_config = {"from_attributes": True}
