from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from .schemas import MeetingCreate, MeetingUpdate, MeetingSchema
from .repository import meeting_repo
from ...core.dependencies import get_current_user

router = APIRouter()

@router.post("/", response_model=MeetingSchema, status_code=status.HTTP_201_CREATED)
async def request_meeting(
    meeting: MeetingCreate,
    current_user: dict = Depends(get_current_user)
):
    # Ensure visitor matches current user
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
    # Ownership check should be added here
    return await meeting_repo.get_stand_meetings(stand_id)

@router.patch("/{meeting_id}", response_model=MeetingSchema)
async def update_meeting(
    meeting_id: str,
    update: MeetingUpdate,
    current_user: dict = Depends(get_current_user)
):
    updated = await meeting_repo.update_meeting_status(meeting_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return updated
