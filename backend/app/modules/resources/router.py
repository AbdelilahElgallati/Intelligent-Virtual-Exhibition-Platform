from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
import os
import shutil
from .schemas import ResourceCreate, ResourceSchema
from .repository import resource_repo
from ...core.dependencies import get_current_user

router = APIRouter()

UPLOAD_DIR = "uploads/resources"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=ResourceSchema)
async def upload_resource(
    stand_id: str = Form(...),
    title: str = Form(...),
    type: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # In production, use S3 or similar. Local storage for now.
    file_path = os.path.join(UPLOAD_DIR, f"{stand_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    resource_data = ResourceCreate(
        title=title,
        description=description,
        stand_id=stand_id,
        type=type,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
        mime_type=file.content_type or "application/octet-stream",
        tags=[]
    )
    
    return await resource_repo.create_resource(resource_data)

@router.get("/stand/{stand_id}", response_model=List[ResourceSchema])
async def get_catalog(stand_id: str):
    return await resource_repo.get_resources_by_stand(stand_id)

@router.get("/{resource_id}/track")
async def track_download(resource_id: str):
    await resource_repo.increment_downloads(resource_id)
    return {"status": "tracked"}
