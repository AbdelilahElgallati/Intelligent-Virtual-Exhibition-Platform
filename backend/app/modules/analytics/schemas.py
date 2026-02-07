from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

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
