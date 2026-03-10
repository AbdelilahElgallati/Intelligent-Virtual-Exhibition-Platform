from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from .schemas import LeadSchema, LeadInteraction
from .repository import lead_repo
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
            detail="You do not have permission to access leads for this stand"
        )
    return stand

@router.get("/stand/{stand_id}", response_model=List[LeadSchema])
async def get_leads(stand_id: str, current_user: dict = Depends(get_current_user)):
    await verify_stand_ownership(stand_id, str(current_user["_id"]))
    return await lead_repo.get_stand_leads(stand_id)

@router.post("/interactions", status_code=201)
async def track_interaction(
    interaction: LeadInteraction,
    current_user: dict = Depends(get_current_user)
):
    await lead_repo.log_interaction(interaction)
    return {"status": "logged"}

@router.get("/export/{stand_id}")
async def export_leads(stand_id: str, current_user: dict = Depends(get_current_user)):
    await verify_stand_ownership(stand_id, str(current_user["_id"]))
    leads = await lead_repo.get_stand_leads(stand_id)
    # Mock CSV export
    return {"message": f"Exported {len(leads)} leads successfully", "format": "csv"}
