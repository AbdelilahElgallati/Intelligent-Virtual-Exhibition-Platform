from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
import os
from .schemas import ResourceCreate, ResourceSchema
from .repository import resource_repo
from ...core.dependencies import get_current_user
from ...core.storage import store_upload

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
    stored = await store_upload(
        file=file,
        local_dir=UPLOAD_DIR,
        local_url_prefix="/uploads/resources",
        r2_folder="resources",
        filename_prefix=str(stand_id),
    )
        
    resource_data = ResourceCreate(
        title=title,
        description=description,
        stand_id=stand_id,
        type=type,
        file_path=stored["url"],
        file_size=stored["size"],
        mime_type=stored["content_type"],
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
