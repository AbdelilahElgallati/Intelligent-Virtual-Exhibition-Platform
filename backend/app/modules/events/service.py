"""
Event service for IVEP.

Provides in-memory event storage and CRUD operations.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from app.modules.events.schemas import EventCreate, EventState, EventUpdate


# In-memory event store
EVENTS_STORE: dict[UUID, dict] = {}


def create_event(data: EventCreate, organizer_id: UUID) -> dict:
    """
    Create a new event in DRAFT state.
    
    Args:
        data: Event creation data.
        organizer_id: ID of the organizer creating the event.
        
    Returns:
        dict: Created event data.
    """
    event_id = uuid4()
    now = datetime.now(timezone.utc)
    
    event = {
        "id": event_id,
        "title": data.title,
        "description": data.description,
        "organizer_id": organizer_id,
        "state": EventState.DRAFT,
        "created_at": now,
    }
    
    EVENTS_STORE[event_id] = event
    return event


def get_event_by_id(event_id: UUID) -> Optional[dict]:
    """
    Get event by ID.
    
    Args:
        event_id: Event ID.
        
    Returns:
        dict: Event data or None if not found.
    """
    return EVENTS_STORE.get(event_id)


def list_events(organizer_id: Optional[UUID] = None, state: Optional[EventState] = None) -> list[dict]:
    """
    List all events with optional filters.
    
    Args:
        organizer_id: Filter by organizer ID.
        state: Filter by event state.
        
    Returns:
        list[dict]: List of events.
    """
    events = list(EVENTS_STORE.values())
    
    if organizer_id:
        events = [e for e in events if e["organizer_id"] == organizer_id]
    
    if state:
        events = [e for e in events if e["state"] == state]
    
    return events


def update_event(event_id: UUID, data: EventUpdate) -> Optional[dict]:
    """
    Update an event.
    
    Args:
        event_id: Event ID.
        data: Update data.
        
    Returns:
        dict: Updated event data or None if not found.
    """
    event = EVENTS_STORE.get(event_id)
    if event is None:
        return None
    
    if data.title is not None:
        event["title"] = data.title
    if data.description is not None:
        event["description"] = data.description
    
    return event


def delete_event(event_id: UUID) -> bool:
    """
    Delete an event.
    
    Args:
        event_id: Event ID.
        
    Returns:
        bool: True if deleted, False if not found.
    """
    if event_id in EVENTS_STORE:
        del EVENTS_STORE[event_id]
        return True
    return False


def update_event_state(event_id: UUID, new_state: EventState) -> Optional[dict]:
    """
    Update event state.
    
    Args:
        event_id: Event ID.
        new_state: New event state.
        
    Returns:
        dict: Updated event data or None if not found.
    """
    event = EVENTS_STORE.get(event_id)
    if event is None:
        return None
    
    event["state"] = new_state
    return event
