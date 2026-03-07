"""
Subscriptions module router for IVEP.

Handles subscription assignments and plan retrieval.
"""

from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_role, require_roles
from app.core.store import FAKE_ORGANIZATIONS
from app.modules.auth.enums import Role
from app.modules.subscriptions.schemas import SubscriptionAssign, SubscriptionRead, SubscriptionPlan
from app.modules.subscriptions.service import assign_plan, get_plan, SUBSCRIPTIONS_STORE


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


# ============== Admin Subscription Management ==============

class AdminSubscriptionRead(BaseModel):
    """Extended subscription read for admin view."""
    organization_id: str
    organization_name: str
    plan: SubscriptionPlan
    status: str = "active"


class PlanOverrideRequest(BaseModel):
    """Schema for admin plan override."""
    plan: SubscriptionPlan


@router.get("/admin/all", response_model=list[AdminSubscriptionRead])
async def admin_list_subscriptions(
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> list[AdminSubscriptionRead]:
    """
    Admin: List subscription plan for every organization stored in MongoDB.

    Falls back to FREE for organisations without an explicit plan in the store.
    """
    from app.modules.organizations.service import list_organizations

    orgs = await list_organizations()
    result = []
    for org in orgs:
        org_id_str = str(org.get("_id", ""))

        # SUBSCRIPTIONS_STORE uses UUID keys (legacy) — match by string representation.
        plan = SubscriptionPlan.FREE
        for k, v in SUBSCRIPTIONS_STORE.items():
            if str(k) == org_id_str:
                plan = v
                break

        result.append(
            AdminSubscriptionRead(
                organization_id=org_id_str,
                organization_name=org.get("name", "Unknown"),
                plan=plan,
                status="suspended" if org.get("is_suspended") else "active",
            )
        )
    return result


@router.delete("/admin/{organization_id}", response_model=AdminSubscriptionRead)
async def admin_cancel_subscription(
    organization_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> AdminSubscriptionRead:
    """
    Admin: Cancel an organization's subscription (reset to FREE).
    """
    from app.modules.organizations.service import get_organization_by_id

    org = await get_organization_by_id(organization_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Reset in store
    for k in list(SUBSCRIPTIONS_STORE.keys()):
        if str(k) == organization_id:
            SUBSCRIPTIONS_STORE[k] = SubscriptionPlan.FREE
            break

    return AdminSubscriptionRead(
        organization_id=organization_id,
        organization_name=org.get("name", "Unknown"),
        plan=SubscriptionPlan.FREE,
        status="cancelled",
    )


@router.patch("/admin/{organization_id}/override", response_model=AdminSubscriptionRead)
async def admin_override_subscription(
    organization_id: str,
    body: PlanOverrideRequest,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> AdminSubscriptionRead:
    """
    Admin: Manually override a subscription plan for any organization.
    """
    from app.modules.organizations.service import get_organization_by_id

    org = await get_organization_by_id(organization_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Override in store — match existing UUID key or add new string key
    matched = False
    for k in SUBSCRIPTIONS_STORE.keys():
        if str(k) == organization_id:
            SUBSCRIPTIONS_STORE[k] = body.plan
            matched = True
            break
    if not matched:
        SUBSCRIPTIONS_STORE[organization_id] = body.plan  # type: ignore[index]

    return AdminSubscriptionRead(
        organization_id=organization_id,
        organization_name=org.get("name", "Unknown"),
        plan=body.plan,
        status="active",
    )
