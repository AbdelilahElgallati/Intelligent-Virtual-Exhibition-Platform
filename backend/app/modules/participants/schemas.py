"""
Participant schemas for IVEP.

Defines data models for event participants.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ParticipantStatus(str, Enum):
    """Participant status in an event."""

    INVITED = "invited"
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    # Enterprise-specific statuses (Week 2)
    PENDING_PAYMENT = "pending_payment"
    PENDING_ADMIN_APPROVAL = "pending_admin_approval"


class ParticipantBase(BaseModel):
    """Base schema for participant data."""

    id: str = Field(alias="_id")
    event_id: str
    user_id: str
    status: ParticipantStatus
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ParticipantRead(BaseModel):
    """Schema for reading participant data."""

    id: str = Field(alias="_id")
    event_id: str
    user_id: str
    status: ParticipantStatus
    created_at: datetime
    rejection_reason: Optional[str] = None

    model_config = {"from_attributes": True, "populate_by_name": True}


# ── Enterprise request enrichment schemas ────────────────────────────────────

class RejectRequest(BaseModel):
    """Body for rejecting a participant — reason is optional."""
    reason: Optional[str] = None


class EnterpriseUserInfo(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: str
    is_active: bool = True


class EnterpriseOrgInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    industry: Optional[str] = None


# Subscription plan feature disabled — not in use for now
# class EnterpriseSubscriptionInfo(BaseModel):
#     plan: Optional[str] = None


class EnterpriseHistoryInfo(BaseModel):
    total_approved: int = 0
    last_event_id: Optional[str] = None
    last_event_date: Optional[datetime] = None


class ParticipantItem(BaseModel):
    """Slim participant sub-object inside EnterpriseRequestItem."""
    id: str
    status: str
    created_at: datetime
    user_id: str
    rejection_reason: Optional[str] = None


class EnterpriseRequestItem(BaseModel):
    """Enriched enterprise join-request row returned by the admin list endpoint."""
    participant: ParticipantItem
    user: EnterpriseUserInfo
    organization: Optional[EnterpriseOrgInfo] = None
    # subscription: Optional[EnterpriseSubscriptionInfo] = None  # disabled
    history: EnterpriseHistoryInfo

    model_config = {"from_attributes": True}


class EnterpriseRequestsResponse(BaseModel):
    """Paginated response for enterprise join-request list."""
    items: List[EnterpriseRequestItem]
    total: int
    skip: int
    limit: int


class EnterpriseJoinResponse(BaseModel):
    """Response after enterprise joins an event."""
    participant_id: str
    event_id: str
    organization_id: str
    status: ParticipantStatus
    stand_fee_paid: bool = False
    payment_reference: Optional[str] = None
    created_at: datetime
