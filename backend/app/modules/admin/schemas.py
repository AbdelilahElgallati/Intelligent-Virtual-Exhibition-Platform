"""
Admin-specific schemas for IVEP.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PartnerStats(BaseModel):
    """Statistics for a partner (Organizer or Enterprise)."""
    
    # Organizer stats
    total_events: Optional[int] = 0
    total_visitors: Optional[int] = 0
    total_revenue: Optional[float] = 0.0
    
    # Enterprise stats
    total_stands: Optional[int] = 0
    total_leads: Optional[int] = 0
    total_meetings: Optional[int] = 0


class PartnerDashboardRead(BaseModel):
    """Rich data for admin dashboard view of a partner."""
    
    id: str = Field(alias="_id")
    name: str
    description: Optional[str] = None
    industry: Optional[str] = "General"
    website: Optional[str] = None
    contact_email: Optional[str] = None
    logo_url: Optional[str] = None
    
    # Owner / Registrant info
    owner_id: str
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_role: str  # "organizer" or "enterprise"
    
    # Moderation
    is_verified: bool = False
    is_flagged: bool = False
    is_suspended: bool = False
    
    # Statistics
    stats: PartnerStats
    created_at: datetime
    
    model_config = {"from_attributes": True, "populate_by_name": True}
