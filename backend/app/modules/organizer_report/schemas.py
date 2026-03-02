"""
Pydantic schemas for the Organizer Summary Report (Week 6).
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RevenueSummary(BaseModel):
    ticket_revenue: float = 0.0
    stand_revenue: float = 0.0
    total_revenue: float = 0.0


class OverviewMetrics(BaseModel):
    total_visitors: int = 0
    enterprise_participation_rate: float = 0.0  # 0–100 %
    stand_engagement_score: float = 0.0          # 0–100
    leads_generated: int = 0
    meetings_booked: int = 0
    chat_interactions: int = 0
    revenue_summary: RevenueSummary = Field(default_factory=RevenueSummary)


class SafetyMetrics(BaseModel):
    total_flags: int = 0
    resolved_flags: int = 0
    resolution_rate: float = 0.0  # 0–100 %


class TrendPoint(BaseModel):
    date: str   # "YYYY-MM-DD"
    value: int


class PerformanceTrends(BaseModel):
    visitors_over_time: List[TrendPoint] = []
    engagement_over_time: List[TrendPoint] = []
    lead_generation_over_time: List[TrendPoint] = []


class OrganizerSummaryResponse(BaseModel):
    overview: OverviewMetrics = Field(default_factory=OverviewMetrics)
    safety: SafetyMetrics = Field(default_factory=SafetyMetrics)
    performance_trends: PerformanceTrends = Field(default_factory=PerformanceTrends)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
