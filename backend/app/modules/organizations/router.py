"""
Organizations module router for IVEP.

Handles organization-related endpoints.
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.dependencies import get_current_user, require_roles
from app.core.store import FAKE_ORGANIZATIONS, FAKE_ORG_MEMBERS, get_user_by_email
from app.modules.auth.schemas import Role
from app.modules.organizations.schemas import (
    OrganizationCreate,
    OrganizationMember,
    OrganizationRead,
    OrgMemberRole,
)


router = APIRouter(prefix="/organizations", tags=["Organizations"])


class InviteRequest(BaseModel):
    """Schema for organization invite request."""
    organization_id: UUID
    email: EmailStr
    role_in_org: OrgMemberRole = OrgMemberRole.MEMBER


class InviteResponse(BaseModel):
    """Schema for organization invite response."""
    message: str
    organization_id: UUID
    invited_email: str
    role_in_org: str


@router.post("/create", response_model=OrganizationRead)
async def create_organization(
    request: OrganizationCreate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> OrganizationRead:
    """
    Create a new organization.
    
    Only admins and organizers can create organizations.
    
    Args:
        request: Organization creation data.
        current_user: Authenticated user.
        
    Returns:
        OrganizationRead: Created organization data.
    """
    org_id = uuid4()
    now = datetime.now(timezone.utc)
    
    organization = {
        "id": org_id,
        "name": request.name,
        "description": request.description,
        "owner_id": current_user["id"],
        "created_at": now,
    }
    
    # Store organization
    FAKE_ORGANIZATIONS[org_id] = organization
    
    # Add owner as organization member
    member = {
        "user_id": current_user["id"],
        "organization_id": org_id,
        "role_in_org": OrgMemberRole.OWNER,
        "joined_at": now,
    }
    FAKE_ORG_MEMBERS.append(member)
    
    return OrganizationRead(**organization)


@router.post("/invite", response_model=InviteResponse)
async def invite_to_organization(
    request: InviteRequest,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> InviteResponse:
    """
    Invite a user to an organization.
    
    Only admins and organizers can invite users.
    This is a mock implementation - no real invite is sent.
    
    Args:
        request: Invite request data.
        current_user: Authenticated user.
        
    Returns:
        InviteResponse: Invite confirmation.
        
    Raises:
        HTTPException: If organization not found or user not authorized.
    """
    # Check if organization exists
    organization = FAKE_ORGANIZATIONS.get(request.organization_id)
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    
    # Check if current user is owner or admin
    is_owner = organization["owner_id"] == current_user["id"]
    is_admin = current_user["role"] == Role.ADMIN
    
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to invite users to this organization",
        )
    
    # Check if user exists (optional - could allow inviting non-existing users)
    invited_user = get_user_by_email(request.email)
    
    # Mock: Add member if user exists
    if invited_user:
        now = datetime.now(timezone.utc)
        member = {
            "user_id": invited_user["id"],
            "organization_id": request.organization_id,
            "role_in_org": request.role_in_org,
            "joined_at": now,
        }
        FAKE_ORG_MEMBERS.append(member)
    
    return InviteResponse(
        message=f"Invitation sent to {request.email}" if not invited_user else f"User {request.email} added to organization",
        organization_id=request.organization_id,
        invited_email=request.email,
        role_in_org=request.role_in_org.value,
    )


@router.get("/", response_model=list[OrganizationRead])
async def list_organizations(
    current_user: dict = Depends(get_current_user),
) -> list[OrganizationRead]:
    """
    List all organizations (for authenticated users).
    
    Returns:
        list[OrganizationRead]: List of all organizations.
    """
    return [OrganizationRead(**org) for org in FAKE_ORGANIZATIONS.values()]
