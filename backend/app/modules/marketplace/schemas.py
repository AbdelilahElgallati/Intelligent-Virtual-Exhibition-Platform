"""
Marketplace schemas — stand products & orders.
Completely isolated from the event payment system.
"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


# ── Product ─────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    price: float = Field(..., gt=0)
    currency: str = Field("usd", max_length=10)
    image_url: str = Field("", max_length=1000)
    stock: int = Field(..., ge=0)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    price: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = Field(None, max_length=10)
    image_url: Optional[str] = Field(None, max_length=1000)
    stock: Optional[int] = Field(None, ge=0)


class ProductOut(BaseModel):
    id: str
    stand_id: str
    name: str
    description: str = ""
    price: float
    currency: str = "usd"
    image_url: str = ""
    stock: int = 0
    created_at: datetime


# ── Order ───────────────────────────────────────────────────────────

class OrderOut(BaseModel):
    id: str
    product_id: str
    stand_id: str
    buyer_id: str
    product_name: str = ""
    quantity: int
    total_amount: float
    stripe_session_id: str = ""
    stripe_payment_intent: str = ""
    status: Literal["pending", "paid", "cancelled"] = "pending"
    created_at: datetime
    paid_at: Optional[datetime] = None


# ── Checkout ────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    quantity: int = Field(1, ge=1, le=100)


class CartItem(BaseModel):
    product_id: str
    quantity: int = Field(1, ge=1, le=100)


class CartCheckoutRequest(BaseModel):
    items: list[CartItem] = Field(..., min_length=1, max_length=50)


class CheckoutResponse(BaseModel):
    session_url: str
    order_id: str


class CartCheckoutResponse(BaseModel):
    session_url: str
    order_ids: list[str]
