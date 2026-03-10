from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from .schemas import MeetingCreate, MeetingUpdate, MeetingSchema
from .repository import meeting_repo
from ...core.dependencies import get_current_user
from ..stands.service import get_stand_by_id
from ..organizations.service import get_organization_by_id

router = APIRouter()

async def verify_stand_ownership(stand_id: str, user_id: str):
    stand = await get_stand_by_id(stand_id)
    if not stand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")
    
    org = await get_organization_by_id(stand["organization_id"])
    if not org or org["owner_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You do not have permission to access meetings for this stand"
        )
    return stand

@router.post("/", response_model=MeetingSchema, status_code=status.HTTP_201_CREATED)
async def request_meeting(
    meeting: MeetingCreate,
    current_user: dict = Depends(get_current_user)
):
    # Auto-fill "SELF" so the frontend can request B2B meetings without
    # having to know its own Mongo _id on the client side.
    if meeting.visitor_id == "SELF":
        meeting = meeting.model_copy(update={"visitor_id": str(current_user["_id"])})

    # Ensure requester matches current user
    if meeting.visitor_id != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Cannot request meeting for another visitor")
    
    return await meeting_repo.create_meeting(meeting)

@router.get("/my-meetings", response_model=List[MeetingSchema])
async def get_my_meetings(current_user: dict = Depends(get_current_user)):
    return await meeting_repo.get_visitor_meetings(str(current_user["_id"]))

@router.get("/stand/{stand_id}", response_model=List[MeetingSchema])
async def get_stand_meetings(
    stand_id: str,
    current_user: dict = Depends(get_current_user)
):
    await verify_stand_ownership(stand_id, str(current_user["_id"]))
    return await meeting_repo.get_stand_meetings(stand_id)

@router.patch("/{meeting_id}", response_model=MeetingSchema)
async def update_meeting(
    meeting_id: str,
    update: MeetingUpdate,
    current_user: dict = Depends(get_current_user)
):
    # Optional: verify ownership if enterprise or matches visitor
    updated = await meeting_repo.update_meeting_status(meeting_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return updated
