"""
Organization schemas for IVEP.

Defines data models for organizations and membership.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class OrgMemberRole(str, Enum):
    """Roles within an organization."""
    
    OWNER = "owner"
    MANAGER = "manager"
    MEMBER = "member"


class OrganizationBase(BaseModel):
    """Base schema for organization data."""
    
    id: str = Field(alias="_id")
    name: str
    description: Optional[str] = None
    owner_id: str
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class OrganizationCreate(BaseModel):
    """Schema for creating a new organization."""
    
    name: str
    description: Optional[str] = None
    
    model_config = {"from_attributes": True}


class OrganizationRead(BaseModel):
    """Schema for reading organization data."""
    
    id: str = Field(alias="_id")
    name: str
    description: Optional[str] = None
    owner_id: str
    created_at: datetime

    # Moderation fields (admin-controlled)
    is_verified: bool = False
    is_flagged: bool = False
    is_suspended: bool = False
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class OrganizationUpdate(BaseModel):
    """Schema for updating organization data."""
    
    name: Optional[str] = None
    description: Optional[str] = None
    
    model_config = {"from_attributes": True}


class OrganizationMember(BaseModel):
    """Schema for organization membership."""
    
    user_id: str
    organization_id: str
    role_in_org: OrgMemberRole = OrgMemberRole.MEMBER
    joined_at: datetime
    
    model_config = {"from_attributes": True}
