from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from .schemas import LeadSchema, LeadInteraction
from .repository import lead_repo
from ...core.dependencies import get_current_user
from ..stands.service import get_stand_by_id
from ..organizations.service import get_organization_by_id
from ...db.mongo import get_database
from ...db.utils import _oid_or_value

router = APIRouter()

async def verify_stand_ownership(stand_id: str, user_id: str):
    stand = await get_stand_by_id(stand_id)
    if not stand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")
    
    db = get_database()
    # Check if user is the organization owner
    org = await db["organizations"].find_one({"_id": _oid_or_value(stand["organization_id"])})
    if org and str(org.get("owner_id")) == user_id:
        return stand

    # Fallback: Check if user is a member of the organization
    member_doc = await db["organization_members"].find_one({
        "user_id": user_id,
        "organization_id": str(stand["organization_id"])
    })
    if member_doc:
        return stand

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, 
        detail="You do not have permission to access leads for this stand"
    )

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

import csv, io
from fastapi.responses import StreamingResponse

@router.get("/export/{stand_id}")
async def export_leads(stand_id: str, current_user: dict = Depends(get_current_user)):
    stand = await verify_stand_ownership(stand_id, str(current_user["_id"]))
    leads = await lead_repo.get_stand_leads(stand_id)
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "visitor_name", "visitor_email", "interaction_type", "score", "last_interaction"
    ])
    writer.writeheader()
    for lead in leads:
        writer.writerow({
            "id": str(lead.get("_id", lead.get("id", ""))),
            "visitor_name": lead.get("visitor_name", ""),
            "visitor_email": lead.get("visitor_email", ""),
            "interaction_type": lead.get("interaction_type", ""),
            "score": lead.get("score", 0),
            "last_interaction": str(lead.get("last_interaction", "")),
        })
    
    output.seek(0)
    filename = f"leads_{stand.get('slug', stand_id)}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
