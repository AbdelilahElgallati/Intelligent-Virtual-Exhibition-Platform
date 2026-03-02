"""
Participants module router for IVEP.

Handles participant invitations and join requests.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_roles
from app.modules.auth.enums import Role
from app.modules.events.service import get_event_by_id
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import create_notification
from app.modules.participants.schemas import (
    ParticipantRead,
    ParticipantStatus,
    RejectRequest,
)
from app.modules.participants.service import (
    approve_participant,
    get_participant_by_id,
    get_user_participation,
    invite_participant,
    list_event_participants,
    reject_participant_with_reason,
    request_to_join,
)
from app.modules.audit.service import log_audit


router = APIRouter(prefix="/events/{event_id}/participants", tags=["Participants"])


class InviteRequest(BaseModel):
    """Schema for inviting a participant."""
    user_id: str


@router.post("/invite", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def invite_user_to_event(
    event_id: str,
    request: InviteRequest,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    existing = await get_user_participation(event_id, request.user_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has a participation record")

    participant = await invite_participant(event_id, request.user_id)

    await create_notification(
        user_id=request.user_id,
        type=NotificationType.INVITATION_SENT,
        message=f"You have been invited to event '{event['title']}'.",
    )

    return ParticipantRead(**participant)


@router.post("/request", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def request_to_join_event(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.VISITOR, Role.ENTERPRISE])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    existing = await get_user_participation(event_id, current_user["_id"])
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already have a participation record")

    participant = await request_to_join(event_id, current_user["_id"])
    return ParticipantRead(**participant)


@router.post("/{participant_id}/approve", response_model=ParticipantRead)
async def approve_event_participant(
    event_id: str,
    participant_id: str,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    participant = await get_participant_by_id(participant_id)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")

    if str(participant.get("event_id")) != str(event_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participant does not belong to this event")

    updated = await approve_participant(participant_id)

    await create_notification(
        user_id=participant["user_id"],
        type=NotificationType.PARTICIPANT_ACCEPTED,
        message=f"Your request to join '{event['title']}' has been approved.",
    )

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="enterprise.approve",
        entity="participant",
        entity_id=participant_id,
        metadata={
            "event_id": event_id,
            "enterprise_user_id": participant.get("user_id"),
        },
    )

    return ParticipantRead(**updated)


@router.post("/{participant_id}/reject", response_model=ParticipantRead)
async def reject_event_participant(
    event_id: str,
    participant_id: str,
    body: RejectRequest = RejectRequest(),
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> ParticipantRead:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    participant = await get_participant_by_id(participant_id)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")

    if str(participant.get("event_id")) != str(event_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participant does not belong to this event")

    updated = await reject_participant_with_reason(participant_id, reason=body.reason)

    # Audit log
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="enterprise.reject",
        entity="participant",
        entity_id=participant_id,
        metadata={
            "event_id": event_id,
            "enterprise_user_id": participant.get("user_id"),
            "reason": body.reason,
        },
    )

    return ParticipantRead(**updated)


@router.get("/", response_model=list[ParticipantRead])
async def get_event_participants(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> list[ParticipantRead]:
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    participants = await list_event_participants(event_id)
    return [ParticipantRead(**p) for p in participants]
