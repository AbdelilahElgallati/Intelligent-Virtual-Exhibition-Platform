"""
Subscription schemas for IVEP.

Defines data models for subscription plans and feature access.
"""

from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class SubscriptionPlan(str, Enum):
    """Subscription plan types."""
    
    FREE = "free"
    PRO = "pro"


class SubscriptionBase(BaseModel):
    """Base schema for subscription data."""
    
    organization_id: UUID
    plan: SubscriptionPlan
    
    model_config = {"from_attributes": True}


class SubscriptionAssign(BaseModel):
    """Schema for assigning a subscription."""
    
    organization_id: UUID
    plan: SubscriptionPlan
    
    model_config = {"from_attributes": True}


class SubscriptionRead(BaseModel):
    """Schema for reading subscription data."""
    
    organization_id: UUID
    plan: SubscriptionPlan
    
    model_config = {"from_attributes": True}


# Feature definitions per plan
PLAN_FEATURES: dict[SubscriptionPlan, dict] = {
    SubscriptionPlan.FREE: {
        "max_events": 1,
        "analytics_export": False,
        "priority_support": False,
    },
    SubscriptionPlan.PRO: {
        "max_events": -1,  # Unlimited
        "analytics_export": True,
        "priority_support": True,
    },
}
