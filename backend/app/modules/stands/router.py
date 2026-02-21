"""
Stands module router for IVEP.

Handles stand assignment for events.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import require_roles
from app.modules.auth.enums import Role
from app.modules.events.service import get_event_by_id
from app.modules.stands.schemas import StandCreate, StandRead, StandUpdate
from app.modules.stands.service import create_stand, get_stand_by_org, list_event_stands, update_stand


router = APIRouter(prefix="/events/{event_id}/stands", tags=["Stands"])


@router.post("/", response_model=StandRead, status_code=status.HTTP_201_CREATED)
async def assign_stand_to_organization(
    event_id: str,
    data: StandCreate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> StandRead:
    """
    Assign a stand to an enterprise organization.
    
    Organizer or Admin only.
    One stand per organization per event.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check ownership for organizers
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # Check if org already has a stand
    base_event_id = event.get("_id", str(event_id))

    existing = await get_stand_by_org(base_event_id, data.organization_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization already has a stand at this event",
        )
    
    stand = await create_stand(
        base_event_id, data.organization_id, data.name,
        description=data.description,
        logo_url=data.logo_url,
        tags=data.tags,
        stand_type=data.stand_type,
        theme_color=data.theme_color,
        stand_background_url=data.stand_background_url,
        presenter_avatar_bg=data.presenter_avatar_bg,
        presenter_name=data.presenter_name,
        presenter_avatar_url=data.presenter_avatar_url,
    )
    return StandRead(**stand)


@router.get("/", response_model=list[StandRead])
async def get_event_stands(event_id: str) -> list[StandRead]:
    """
    List all stands for an event.
    
    Public endpoint.
    """
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    base_event_id = event.get("_id", str(event_id))
    stands = await list_event_stands(base_event_id)
    return [StandRead(**s) for s in stands]


@router.get("/{stand_id}", response_model=StandRead)
async def get_stand(stand_id: str) -> StandRead:
    """
    Get stand details by ID.
    
    Public endpoint.
    """
    from app.modules.stands.service import get_stand_by_id
    
    stand = await get_stand_by_id(stand_id)
    if stand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")
            
    return StandRead(**stand)


@router.patch("/{stand_id}", response_model=StandRead)
async def update_stand_endpoint(
    stand_id: str,
    data: StandUpdate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> StandRead:
    """
    Update stand details.
    
    Organizer or Admin only.
    """
    from app.modules.stands.service import get_stand_by_id
    
    stand = await get_stand_by_id(stand_id)
    if stand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")
    
    updated = await update_stand(stand_id, data.model_dump(exclude_unset=True))
    return StandRead(**updated)
