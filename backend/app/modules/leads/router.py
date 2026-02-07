from fastapi import APIRouter, Depends, HTTPException
from typing import List
from .schemas import LeadSchema, LeadInteraction
from .repository import lead_repo
from ...core.dependencies import get_current_user

router = APIRouter()

@router.get("/stand/{stand_id}", response_model=List[LeadSchema])
async def get_leads(stand_id: str, current_user: dict = Depends(get_current_user)):
    # Should verify stand ownership
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
    leads = await lead_repo.get_stand_leads(stand_id)
    # Mock CSV export
    return {"message": f"Exported {len(leads)} leads successfully", "format": "csv"}
