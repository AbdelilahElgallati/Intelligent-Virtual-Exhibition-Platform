"""
Authentication schemas for IVEP.

Defines data models for authentication, authorization, and user roles.
"""

from enum import Enum

from pydantic import BaseModel, EmailStr, Field

from app.modules.users.schemas import UserRead
from app.modules.auth.enums import Role


class LoginRequest(BaseModel):
    """Schema for user login request."""
    
    email: EmailStr
    password: str
    
    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    """Schema for user registration request."""
    
    email: EmailStr
    username: str
    password: str
    full_name: str
    role: Role = Role.VISITOR
    
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Schema for authentication token response."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead
    
    model_config = {"from_attributes": True}
