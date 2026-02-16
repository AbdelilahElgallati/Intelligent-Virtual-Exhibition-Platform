"""
Organizations module router for IVEP.

Handles organization-related endpoints.
"""

from warnings import warn
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.dependencies import get_current_user, require_roles
from app.modules.users.service import get_user_by_email
from app.modules.auth.enums import Role
from app.modules.organizations.schemas import (
    OrganizationCreate,
    OrganizationRead,
    OrgMemberRole,
)
from app.modules.organizations.service import (
    create_organization as service_create_org,
    list_organizations as service_list_orgs,
    get_organization_by_id,
    add_organization_member,
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
    """
    # Create organization
    organization = await service_create_org(request, current_user["id"])
    return OrganizationRead(**organization)


@router.post("/invite", response_model=InviteResponse)
async def invite_to_organization(
    request: InviteRequest,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> InviteResponse:
    """
    Invite a user to an organization.
    
    Only admins and organizers can invite users.
    This helps populate members for testing.
    """
    # Check if organization exists
    organization = await get_organization_by_id(request.organization_id)
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    
    # Check if current user is owner or admin
    # Note: In a real app we'd check if current_user is a member with ADMIN role in org
    # Here checking against 'created_by' (which is owner_id in our simplified seed model)
    is_owner = str(organization.get("owner_id")) == str(current_user["id"])
    is_admin = current_user["role"] == Role.ADMIN
    
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to invite users to this organization",
        )
    
    # Check if user exists
    invited_user = await get_user_by_email(request.email)
    
    # Real logic: Add member if user exists
    if invited_user:
        await add_organization_member(
            organization_id=request.organization_id,
            user_id=invited_user["id"],
            role=request.role_in_org
        )
    
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
    """
    orgs = await service_list_orgs()
    return [OrganizationRead(**org) for org in orgs]
