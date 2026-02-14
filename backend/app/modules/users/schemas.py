"""
User schemas for IVEP.

Defines data models for user operations.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.modules.auth.enums import Role


class UserBase(BaseModel):
    """Base schema for user data."""
    
    id: UUID
    email: EmailStr
    username: str
    full_name: str
    role: Role
    is_active: bool = True
    created_at: datetime
    
    model_config = {"from_attributes": True}


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
    
    id: UUID
    email: EmailStr
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Schema for updating user data."""
    
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    
    model_config = {"from_attributes": True}
