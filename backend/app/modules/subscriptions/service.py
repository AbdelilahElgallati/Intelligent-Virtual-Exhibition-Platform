"""
Subscription service for IVEP.

Provides in-memory subscription storage and feature access checks.
"""

from typing import Optional
from uuid import UUID

from app.modules.subscriptions.schemas import PLAN_FEATURES, SubscriptionPlan


# In-memory subscription store: organization_id -> plan
SUBSCRIPTIONS_STORE: dict[UUID, SubscriptionPlan] = {}


def assign_plan(organization_id: UUID, plan: SubscriptionPlan) -> SubscriptionPlan:
    """
    Assign a subscription plan to an organization.
    
    Args:
        organization_id: Organization ID.
        plan: Plan to assign.
        
    Returns:
        SubscriptionPlan: Assigned plan.
    """
    SUBSCRIPTIONS_STORE[organization_id] = plan
    return plan


def get_plan(organization_id: UUID) -> SubscriptionPlan:
    """
    Get organization's subscription plan.
    Defaults to FREE if not found.
    
    Args:
        organization_id: Organization ID.
        
    Returns:
        SubscriptionPlan: Current plan.
    """
    return SUBSCRIPTIONS_STORE.get(organization_id, SubscriptionPlan.FREE)


def check_feature_access(organization_id: UUID, feature_name: str) -> bool:
    """
    Check if organization has access to a feature.
    
    Args:
        organization_id: Organization ID.
        feature_name: Name of the feature to check.
        
    Returns:
        bool: True if allowed, False otherwise.
    """
    plan = get_plan(organization_id)
    features = PLAN_FEATURES.get(plan, {})
    
    val = features.get(feature_name)
    
    # Boolean feature
    if isinstance(val, bool):
        return val
        
    # Numeric limit (e.g. max_events)
    # This function just checks boolean flags. 
    # Numeric limits need specific logic elsewhere.
    return False
