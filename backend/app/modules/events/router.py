"""
Events module router for IVEP.

Handles event CRUD and lifecycle state transitions.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user, require_feature, require_role, require_roles
from app.modules.auth.enums import Role
from app.modules.events.schemas import EventCreate, EventRead, EventState, EventUpdate, EventsResponse
from app.modules.events.service import (
    create_event,
    delete_event,
    get_event_by_id,
    get_joined_events,
    list_events,
    update_event,
    update_event_state,
)
from app.modules.participants.service import get_user_participation, request_to_join
from app.modules.participants.schemas import ParticipantRead


router = APIRouter(prefix="/events", tags=["Events"])


# ============== Visitor Endpoints ==============

@router.get("/joined", response_model=EventsResponse)
async def get_my_joined_events(
    current_user: dict = Depends(get_current_user),
) -> EventsResponse:
    """
    Get events where the current user is an APPROVED participant.
    """
    events = await get_joined_events(current_user["id"])
    return EventsResponse(
        events=[EventRead(**e) for e in events],
        total=len(events)
    )


@router.get("/{event_id}/my-status")
async def get_my_event_status(
    event_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """
    Get current user's participation status for an event.
    """
    participation = await get_user_participation(event_id, current_user["id"])
    if participation:
        return {"status": participation["status"].upper(), "participant_id": participation["id"]}
    return {"status": "NOT_JOINED", "participant_id": None}


@router.post("/{event_id}/join", response_model=ParticipantRead)
async def join_event(
    event_id: UUID,
    current_user: dict = Depends(require_role(Role.VISITOR)),
) -> ParticipantRead:
    """
    Join or request to join an event.
    """
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    existing = await get_user_participation(event_id, current_user["id"])
    if existing:
        return ParticipantRead(**existing)
        
    # For now, simple logic: if it's a public event, request_to_join sets status
    # In a real app, we'd check event.requires_approval
    # Since event schema doesn't have requires_approval yet, let's assume it doesn't
    # or add it to schemas if needed.
    
    # Minimal implementation: all visitors can join, but status is REQUESTED by default in service
    # Let's adjust service or just use it.
    participant = await request_to_join(event_id, current_user["id"])
    return ParticipantRead(**participant)


# ============== CRUD Endpoints ==============

@router.post("/", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_new_event(
    data: EventCreate,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Create a new event in DRAFT state.
    
    Requires ORGANIZER role.
    """
    event = await create_event(data, current_user["id"])
    return EventRead(**event)


# @router.get("/", response_model=EventsResponse)
# async def get_all_events(
#     organizer_id: Optional[UUID] = None,
#     state: Optional[EventState] = None,
# ) -> EventsResponse:
#     """
#     List all events with optional filters.
    
#     Public endpoint - no authentication required.
#     """
#     events = await list_events(organizer_id=organizer_id, state=state)
#     return EventsResponse(
#         events=[EventRead(**e) for e in events],
#         total=len(events)
#     )

@router.get("/", response_model=EventsResponse)
async def get_all_events(
    organizer_id: Optional[UUID] = None,
    state: Optional[EventState] = None,
    category: Optional[str] = None,  # Add this
    search: Optional[str] = None,    # Add this
) -> EventsResponse:
    """
    List all events with optional filters.
    """
    # Pass the new parameters to the service layer
    events = await list_events(
        organizer_id=organizer_id, 
        state=state, 
        category=category, 
        search=search
    )
    return EventsResponse(
        events=[EventRead(**e) for e in events],
        total=len(events)
    )


@router.get("/{event_id}", response_model=EventRead)
async def get_event(event_id: UUID) -> EventRead:
    """
    Get event by ID.
    
    Public endpoint - no authentication required.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return EventRead(**event)


@router.patch("/{event_id}", response_model=EventRead)
async def update_existing_event(
    event_id: UUID,
    data: EventUpdate,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Update an event.
    
    Requires ORGANIZER role.
    Only the organizer who created the event can update it.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    if event["organizer_id"] != str(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this event",
        )
    
    updated_event = await update_event(event_id, data)
    return EventRead(**updated_event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_event(
    event_id: UUID,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    """
    Delete an event.
    
    Requires ORGANIZER role.
    Only the organizer who created the event can delete it.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    if event["organizer_id"] != str(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this event",
        )
    
    deleted = await delete_event(event_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete event",
        )


# ============== State Transition Endpoints ==============

@router.post("/{event_id}/submit", response_model=EventRead)
async def submit_event_for_approval(
    event_id: UUID,
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> EventRead:
    """
    Submit an event for approval.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["organizer_id"] != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if event["state"] != EventState.DRAFT:
        raise HTTPException(status_code=400, detail="Only DRAFT events can be submitted")
        
    updated = await update_event_state(event_id, EventState.PENDING_APPROVAL)
    return EventRead(**updated)


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
    event = await get_event_by_id(event_id)
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
    
    updated_event = await update_event_state(event_id, EventState.APPROVED)
    
    # Notify organizer
    await create_notification(
        user_id=event["organizer_id"],
        type=NotificationType.EVENT_APPROVED,
        message=f"Your event '{event['title']}' has been approved.",
    )
    
    return EventRead(**updated_event)


@router.post("/{event_id}/start", response_model=EventRead)
async def start_event(
    event_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Start event (go live).
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Check ownership
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["id"]):
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
    
    updated_event = await update_event_state(event_id, EventState.LIVE)
    return EventRead(**updated_event)


@router.post("/{event_id}/close", response_model=EventRead)
async def close_event(
    event_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> EventRead:
    """
    Close event.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    
    # Check ownership
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["id"]):
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
    
    updated_event = await update_event_state(event_id, EventState.CLOSED)
    return EventRead(**updated_event)
