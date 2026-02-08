"""
Participants module router for IVEP.

Handles participant invitations and join requests.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_roles
from app.modules.auth.schemas import Role
from app.modules.events.service import get_event_by_id
from app.modules.participants.schemas import ParticipantRead, ParticipantStatus
from app.modules.participants.service import (
    approve_participant,
    get_participant_by_id,
    get_user_participation,
    invite_participant,
    list_event_participants,
    reject_participant,
    request_to_join,
)


router = APIRouter(prefix="/events/{event_id}/participants", tags=["Participants"])


class InviteRequest(BaseModel):
    """Schema for inviting a participant."""
    user_id: UUID


@router.post("/invite", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def invite_user_to_event(
    event_id: UUID,
    request: InviteRequest,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    """
    Invite a user to an event.
    
    Organizer or Admin only.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check ownership for organizers
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # Check if user already has participation
    existing = get_user_participation(event_id, request.user_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has a participation record")
    
    participant = invite_participant(event_id, request.user_id)
    return ParticipantRead(**participant)


@router.post("/request", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def request_to_join_event(
    event_id: UUID,
    current_user: dict = Depends(require_roles([Role.VISITOR, Role.ENTERPRISE])),
) -> ParticipantRead:
    """
    Request to join an event.
    
    Visitor or Enterprise only.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check if user already has participation
    existing = get_user_participation(event_id, current_user["id"])
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already have a participation record")
    
    participant = request_to_join(event_id, current_user["id"])
    return ParticipantRead(**participant)


@router.post("/{participant_id}/approve", response_model=ParticipantRead)
async def approve_event_participant(
    event_id: UUID,
    participant_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    """
    Approve a participant.
    
    Organizer or Admin only.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check ownership for organizers
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    participant = get_participant_by_id(participant_id)
    if participant is None or participant["event_id"] != event_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    
    updated = approve_participant(participant_id)
    return ParticipantRead(**updated)


@router.post("/{participant_id}/reject", response_model=ParticipantRead)
async def reject_event_participant(
    event_id: UUID,
    participant_id: UUID,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    """
    Reject a participant.
    
    Organizer or Admin only.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check ownership for organizers
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    participant = get_participant_by_id(participant_id)
    if participant is None or participant["event_id"] != event_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    
    updated = reject_participant(participant_id)
    return ParticipantRead(**updated)


@router.get("/", response_model=list[ParticipantRead])
async def get_event_participants(
    event_id: UUID,
    status_filter: ParticipantStatus | None = None,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> list[ParticipantRead]:
    """
    List event participants.
    
    Organizer or Admin only.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check ownership for organizers
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    participants = list_event_participants(event_id, status=status_filter)
    return [ParticipantRead(**p) for p in participants]
