from ...db.mongo import get_database
from typing import List, Dict
from datetime import datetime, timedelta

class AnalyticsRepository:
    @property
    def db(self):
        return get_database()

    async def get_stand_analytics(self, stand_id: str, days: int = 30) -> Dict:
        # Mocking complex aggregation for now
        # In production, this would use MongoDB's aggregate pipeline
        return {
            "kpis": [
                {"label": "Total Visits", "value": 1240, "trend": 12.5},
                {"label": "Unique Visitors", "value": 850, "trend": 8.2},
                {"label": "Leads Generated", "value": 45, "trend": -2.4},
                {"label": "Avg. Engagement", "value": 4.5, "unit": "min", "trend": 15.0}
            ],
            "main_chart": [
                {"timestamp": (datetime.utcnow() - timedelta(days=i)).isoformat(), "value": 30 + i * 2} 
                for i in range(days, 0, -1)
            ],
            "distribution": {
                "Resources": 40,
                "Chat": 35,
                "Video": 25
            },
            "recent_activity": []
        }

    async def get_event_analytics(self, event_id: str) -> Dict:
        return {
            "kpis": [
                {"label": "Total Participants", "value": 5200, "trend": 5.0},
                {"label": "Live Sessions", "value": 12, "trend": 0},
                {"label": "Stand Interactions", "value": 15400, "trend": 22.1}
            ],
            "main_chart": [],
            "distribution": {},
            "recent_activity": []
        }

analytics_repo = AnalyticsRepository()
