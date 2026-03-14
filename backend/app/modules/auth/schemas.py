"""
Authentication schemas for IVEP.

Defines data models for authentication, authorization, and user roles.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.modules.users.schemas import UserRead
from app.modules.auth.enums import Role


class LoginRequest(BaseModel):
    """Schema for user login request."""
    
    # Keep as string so local/dev seed accounts like *.test can authenticate.
    email: str
    password: str
    
    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    """Schema for user registration request."""
    
    email: EmailStr
    username: str
    password: str
    full_name: str
    role: Role = Role.VISITOR
    
    # Enterprise-specific fields (optional, used if role == ENTERPRISE)
    company_name: Optional[str] = None
    professional_email: Optional[EmailStr] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    creation_year: Optional[int] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    linkedin: Optional[str] = None

    # Organizer-specific fields (optional, used if role == ORGANIZER)
    org_name: Optional[str] = None          # Organisation / company name
    org_type: Optional[str] = None          # NGO, Company, University, Government…
    org_country: Optional[str] = None
    org_city: Optional[str] = None
    org_phone: Optional[str] = None
    org_website: Optional[str] = None
    org_professional_email: Optional[EmailStr] = None
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Schema for authentication token response."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead
    
    model_config = {"from_attributes": True}
