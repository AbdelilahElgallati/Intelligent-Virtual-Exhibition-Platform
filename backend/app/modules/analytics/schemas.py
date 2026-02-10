from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum
from uuid import UUID

# --- Person B: Dashboard Models ---

class KPIMetric(BaseModel):
    label: str
    value: float
    unit: Optional[str] = None
    trend: Optional[float] = None # Percentage change

class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    value: float

class DashboardData(BaseModel):
    kpis: List[KPIMetric]
    main_chart: List[TimeSeriesPoint]
    distribution: Dict[str, float]
    recent_activity: List[dict]

class AnalyticsRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    granularity: str = "day" # hour, day, week

# --- Person A: Event Logging Models ---

class AnalyticsEventType(str, Enum):
    """Types of analytics events."""
    
    EVENT_VIEW = "event_view"
    STAND_VISIT = "stand_visit"
    CHAT_OPENED = "chat_opened"


class AnalyticsEventBase(BaseModel):
    """Base schema for analytics data."""
    
    type: AnalyticsEventType
    user_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    stand_id: Optional[UUID] = None
    
    model_config = {"from_attributes": True}


class AnalyticsEventCreate(AnalyticsEventBase):
    """Schema for creating an analytics event."""
    pass


class AnalyticsEventRead(AnalyticsEventBase):
    """Schema for reading analytics data."""
    
    id: UUID
    created_at: datetime
    
    model_config = {"from_attributes": True}
