from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum

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
    enterprises: Optional[List[dict]] = []

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
    MEETING_BOOKED = "meeting_booked"
    PAYMENT_CONFIRMED = "payment_confirmed"
    CONFERENCE_JOINED = "conference_joined"


class AnalyticsEventBase(BaseModel):
    """Base schema for analytics data."""
    
    type: AnalyticsEventType
    user_id: Optional[str] = None
    event_id: Optional[str] = None
    stand_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    model_config = {"from_attributes": True}


class AnalyticsEventCreate(AnalyticsEventBase):
    """Schema for creating an analytics event."""
    pass


class AnalyticsEventRead(AnalyticsEventBase):
    """Schema for reading analytics data."""
    
    id: str = Field(alias="_id")
    created_at: datetime
    timestamp: Optional[datetime] = None
    
    model_config = {"from_attributes": True}
