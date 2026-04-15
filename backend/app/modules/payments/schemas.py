"""
Payment schemas for IVEP.

Payzone-based event ticket payments.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PaymentStatus(str, Enum):
    """Status of an event payment."""

    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"


class EventPaymentRead(BaseModel):
    """Schema for reading an event payment record."""

    id: str = Field(alias="_id")
    event_id: str
    user_id: str
    amount: float
    currency: str = "mad"
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    status: PaymentStatus
    created_at: datetime
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class PaymentStatusResponse(BaseModel):
    """Lightweight response for visitor payment status check."""

    status: str  # "none" | "pending" | "paid"
    stripe_session_id: Optional[str] = None
