from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class ProductStatus(str, Enum):
    PENDING = "PENDING"
    CONTACTED = "CONTACTED"
    CLOSED = "CLOSED"

class EnterpriseProfileUpdate(BaseModel):
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    website: Optional[str] = None
    linkedin: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    theme_color: Optional[str] = None
    branding_theme: Optional[str] = None  # e.g., "Modern", "Classic"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    avatar_gender: Optional[str] = None  # "male" or "female"

class ProductBase(BaseModel):
    name: str
    description: str
    category: str
    is_service: bool = False
    price: Optional[float] = None
    stock: Optional[int] = None  # number of available pieces (products only)
    tags: List[str] = []
    images: List[str] = []
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_service: Optional[bool] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None
    is_active: Optional[bool] = None

class ProductRead(ProductBase):
    id: str = Field(alias="_id")
    enterprise_id: str
    organization_id: str
    created_at: datetime

    class Config:
        populate_by_name = True

class ProductRequestCreate(BaseModel):
    product_id: str
    event_id: str
    message: str
    quantity: Optional[int] = None   # for products; omit/None for services

class ProductRequestStatusUpdate(BaseModel):
    status: ProductStatus

class ProductRequestRead(BaseModel):
    id: str = Field(alias="_id")
    visitor_id: str
    enterprise_id: str
    product_id: str
    event_id: Optional[str] = None
    message: str
    quantity: Optional[int] = None
    status: ProductStatus
    created_at: datetime
    # Enriched fields (populated by repository)
    visitor_name: Optional[str] = None
    visitor_email: Optional[str] = None
    visitor_phone: Optional[str] = None
    product_name: Optional[str] = None
    product_is_service: Optional[bool] = None

    class Config:
        populate_by_name = True
