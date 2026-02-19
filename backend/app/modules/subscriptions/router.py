"""
Subscriptions module router for IVEP.

Handles subscription assignments and plan retrieval.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user, require_role, require_roles
from app.core.store import FAKE_ORGANIZATIONS
from app.modules.auth.enums import Role
from app.modules.subscriptions.schemas import SubscriptionAssign, SubscriptionRead
from app.modules.subscriptions.service import assign_plan, get_plan


router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.post("/assign", response_model=SubscriptionRead)
async def assign_subscription_plan(
    data: SubscriptionAssign,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> SubscriptionRead:
    """
    Assign a subscription plan to an organization.
    
    Admin only.
    """
    # Verify organization exists
    if data.organization_id not in FAKE_ORGANIZATIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    
    assigned_plan = assign_plan(data.organization_id, data.plan)
    
    return SubscriptionRead(
        organization_id=data.organization_id,
        plan=assigned_plan,
    )


@router.get("/org/{organization_id}", response_model=SubscriptionRead)
async def get_organization_plan(
    organization_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> SubscriptionRead:
    """
    Get subscription plan for an organization.
    
    Admin or Organizer (if they own the org).
    """
    # Verify organization exists
    org = FAKE_ORGANIZATIONS.get(organization_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    
    # Check ownership
    if current_user["role"] != Role.ADMIN and org["owner_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this organization's plan",
        )
    
    plan = get_plan(organization_id)
    
    return SubscriptionRead(
        organization_id=organization_id,
        plan=plan,
    )
