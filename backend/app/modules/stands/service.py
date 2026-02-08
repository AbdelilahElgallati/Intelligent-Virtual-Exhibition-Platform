"""
Stand service for IVEP.

Provides in-memory stand storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4


# In-memory stand store
STANDS_STORE: dict[UUID, dict] = {}


def create_stand(event_id: UUID, organization_id: UUID, name: str) -> dict:
    """
    Create a new stand for an organization at an event.
    
    Args:
        event_id: Event ID.
        organization_id: Organization ID.
        name: Stand name.
        
    Returns:
        dict: Created stand data.
    """
    stand_id = uuid4()
    now = datetime.now(timezone.utc)
    
    stand = {
        "id": stand_id,
        "event_id": event_id,
        "organization_id": organization_id,
        "name": name,
        "created_at": now,
    }
    
    STANDS_STORE[stand_id] = stand
    return stand


def get_stand_by_id(stand_id: UUID) -> Optional[dict]:
    """Get stand by ID."""
    return STANDS_STORE.get(stand_id)


def get_stand_by_org(event_id: UUID, organization_id: UUID) -> Optional[dict]:
    """
    Get stand for an organization at an event.
    
    Enforces one stand per organization per event.
    
    Args:
        event_id: Event ID.
        organization_id: Organization ID.
        
    Returns:
        dict: Stand data or None.
    """
    for stand in STANDS_STORE.values():
        if stand["event_id"] == event_id and stand["organization_id"] == organization_id:
            return stand
    return None


def list_event_stands(event_id: UUID) -> list[dict]:
    """
    List all stands for an event.
    
    Args:
        event_id: Event ID.
        
    Returns:
        list[dict]: List of stands.
    """
    return [s for s in STANDS_STORE.values() if s["event_id"] == event_id]
