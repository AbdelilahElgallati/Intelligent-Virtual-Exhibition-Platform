"""
Events module router for IVEP.

Handles event CRUD and lifecycle state transitions.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user, require_feature, require_role, require_roles
from app.modules.auth.schemas import Role
from app.modules.events.schemas import EventCreate, EventRead, EventState, EventUpdate
from app.modules.events.service import (
    create_event,
    delete_event,
    get_event_by_id,
    list_events,
    update_event,
    update_event_state,
)


router = APIRouter(prefix="/events", tags=["Events"])


# ============== CRUD Endpoints ==============

@router.post("/", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_new_event(
    data: EventCreate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
    authorized: dict = Depends(require_feature("max_events")),
) -> EventRead:
    """
    Create a new event in DRAFT state.
    
    Only organizers and admins can create events.
    Checks subscription feature limits.
    """
    event = create_event(data, current_user["id"])
    return EventRead(**event)


@router.get("/", response_model=list[EventRead])
async def get_all_events(
    organizer_id: Optional[UUID] = None,
    state: Optional[EventState] = None,
) -> list[EventRead]:
    """
    List all events with optional filters.
    
    Public endpoint - no authentication required.
    """
    events = list_events(organizer_id=organizer_id, state=state)
    return [EventRead(**e) for e in events]


@router.get("/{event_id}", response_model=EventRead)
async def get_event(event_id: UUID) -> EventRead:
    """
    Get event by ID.
    
    Public endpoint - no authentication required.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return EventRead(**event)


@router.put("/{event_id}", response_model=EventRead)
async def update_existing_event(
    event_id: UUID,
    data: EventUpdate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Update an event.
    
    Organizers can only update their own events.
    Admins can update any event.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Check ownership (organizers can only edit their own events)
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own events",
        )
    
    updated_event = update_event(event_id, data)
    return EventRead(**updated_event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_event(
    event_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> None:
    """
    Delete an event.
    
    Organizers can only delete their own events.
    Admins can delete any event.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Check ownership
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own events",
        )
    
    delete_event(event_id)


# ============== State Transition Endpoints ==============

@router.post("/{event_id}/submit", response_model=EventRead)
async def submit_event(
    event_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Submit event for approval.
    
    Transition: DRAFT → PENDING_APPROVAL
    Only the event organizer can submit.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Check ownership
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit your own events",
        )
    
    # Validate current state
    if event["state"] != EventState.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit event. Current state: {event['state'].value}. Required: draft",
        )
    
    updated_event = update_event_state(event_id, EventState.PENDING_APPROVAL)
    return EventRead(**updated_event)


@router.post("/{event_id}/approve", response_model=EventRead)
async def approve_event(
    event_id: UUID,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Approve event.
    
    Transition: PENDING_APPROVAL → APPROVED
    Admin only.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Validate current state
    if event["state"] != EventState.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve event. Current state: {event['state'].value}. Required: pending_approval",
        )
    
    updated_event = update_event_state(event_id, EventState.APPROVED)
    return EventRead(**updated_event)


@router.post("/{event_id}/start", response_model=EventRead)
async def start_event(
    event_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Start event (go live).
    
    Transition: APPROVED → LIVE
    Only the event organizer or admin can start.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Check ownership
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only start your own events",
        )
    
    # Validate current state
    if event["state"] != EventState.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start event. Current state: {event['state'].value}. Required: approved",
        )
    
    updated_event = update_event_state(event_id, EventState.LIVE)
    return EventRead(**updated_event)


@router.post("/{event_id}/close", response_model=EventRead)
async def close_event(
    event_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Close event.
    
    Transition: LIVE → CLOSED
    Organizer or admin can close.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Check ownership
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only close your own events",
        )
    
    # Validate current state
    if event["state"] != EventState.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot close event. Current state: {event['state'].value}. Required: live",
        )
    
    updated_event = update_event_state(event_id, EventState.CLOSED)
    return EventRead(**updated_event)
