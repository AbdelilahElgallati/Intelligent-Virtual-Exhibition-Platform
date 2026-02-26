"""
Payment schemas for IVEP.

Defines data models for event payment proofs and admin review.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PaymentStatus(str, Enum):
    """Status of a payment proof submission."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EventPaymentRead(BaseModel):
    """Schema for reading an event payment record."""

    id: str = Field(alias="_id")
    event_id: str
    user_id: str
    amount: float
    proof_file_path: str
    status: PaymentStatus
    admin_note: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class PaymentStatusResponse(BaseModel):
    """Lightweight response for visitor payment status check."""

    status: str  # "none" | "pending" | "approved" | "rejected"
    admin_note: Optional[str] = None


class PaymentRejectRequest(BaseModel):
    """Body for admin rejection."""

    admin_note: Optional[str] = None
