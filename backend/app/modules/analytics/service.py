"""
Analytics service for IVEP.

Provides in-memory analytics storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from app.modules.analytics.schemas import AnalyticsEventType


# In-memory analytics store
ANALYTICS_STORE: list[dict] = []


def log_event(
    type: AnalyticsEventType,
    user_id: Optional[UUID] = None,
    event_id: Optional[UUID] = None,
    stand_id: Optional[UUID] = None
) -> dict:
    """
    Log an analytics event.
    
    Args:
        type: Event type.
        user_id: User ID (optional).
        event_id: Event ID (optional).
        stand_id: Stand ID (optional).
        
    Returns:
        dict: Created analytics event data.
    """
    event_id_uuid = uuid4()
    now = datetime.now(timezone.utc)
    
    event = {
        "id": event_id_uuid,
        "type": type,
        "user_id": user_id,
        "event_id": event_id,
        "stand_id": stand_id,
        "created_at": now,
    }
    
    ANALYTICS_STORE.append(event)
    return event


def list_events(limit: int = 100) -> list[dict]:
    """
    List analytics events.
    
    Args:
        limit: Max number of events to return.
        
    Returns:
        list[dict]: List of analytics events.
    """
    # Return most recent first
    return sorted(ANALYTICS_STORE, key=lambda x: x["created_at"], reverse=True)[:limit]
