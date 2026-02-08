"""
Stands module router for IVEP.

Handles stand assignment for events.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import require_roles
from app.modules.auth.schemas import Role
from app.modules.events.service import get_event_by_id
from app.modules.stands.schemas import StandCreate, StandRead
from app.modules.stands.service import create_stand, get_stand_by_org, list_event_stands


router = APIRouter(prefix="/events/{event_id}/stands", tags=["Stands"])


@router.post("/", response_model=StandRead, status_code=status.HTTP_201_CREATED)
async def assign_stand_to_organization(
    event_id: UUID,
    data: StandCreate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> StandRead:
    """
    Assign a stand to an enterprise organization.
    
    Organizer or Admin only.
    One stand per organization per event.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check ownership for organizers
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # Check if org already has a stand
    existing = get_stand_by_org(event_id, data.organization_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization already has a stand at this event",
        )
    
    stand = create_stand(event_id, data.organization_id, data.name)
    return StandRead(**stand)


@router.get("/", response_model=list[StandRead])
async def get_event_stands(event_id: UUID) -> list[StandRead]:
    """
    List all stands for an event.
    
    Public endpoint.
    """
    event = get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    stands = list_event_stands(event_id)
    return [StandRead(**s) for s in stands]
