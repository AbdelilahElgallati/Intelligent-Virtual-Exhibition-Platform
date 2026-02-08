"""
Organization schemas for IVEP.

Defines data models for organizations and membership.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class OrgMemberRole(str, Enum):
    """Roles within an organization."""
    
    OWNER = "owner"
    MANAGER = "manager"
    MEMBER = "member"


class OrganizationBase(BaseModel):
    """Base schema for organization data."""
    
    id: UUID
    name: str
    description: Optional[str] = None
    owner_id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}


class OrganizationCreate(BaseModel):
    """Schema for creating a new organization."""
    
    name: str
    description: Optional[str] = None
    
    model_config = {"from_attributes": True}


class OrganizationRead(BaseModel):
    """Schema for reading organization data."""
    
    id: UUID
    name: str
    description: Optional[str] = None
    owner_id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}


class OrganizationUpdate(BaseModel):
    """Schema for updating organization data."""
    
    name: Optional[str] = None
    description: Optional[str] = None
    
    model_config = {"from_attributes": True}


class OrganizationMember(BaseModel):
    """Schema for organization membership."""
    
    user_id: UUID
    organization_id: UUID
    role_in_org: OrgMemberRole = OrgMemberRole.MEMBER
    joined_at: datetime
    
    model_config = {"from_attributes": True}
