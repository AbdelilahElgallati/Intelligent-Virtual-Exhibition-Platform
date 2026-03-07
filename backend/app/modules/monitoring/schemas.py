"""
Schemas for the live monitoring endpoint.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ActiveUserRead(BaseModel):
    user_id: str
    full_name: str
    role: str
    connected_at: str  # ISO string (already formatted in presence registry)


class RecentFlagRead(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    reason: str
    created_at: datetime


class KPIs(BaseModel):
    active_visitors: int
    active_stands: int
    ongoing_meetings: int
    messages_per_minute: int
    resource_downloads_last_hour: int
    incident_flags_open: int


class LiveMetricsResponse(BaseModel):
    kpis: KPIs
    active_users: List[ActiveUserRead]
    recent_flags: List[RecentFlagRead]
    timestamp: str  # ISO string
