from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ResourceType(str):
    PDF = "pdf"
    VIDEO = "video"
    IMAGE = "image"
    DOCUMENT = "document"

class ResourceBase(BaseModel):
    title: str
    description: Optional[str] = None
    stand_id: str
    type: str # pdf, video, image, doc
    tags: List[str] = []

class ResourceCreate(ResourceBase):
    file_path: str
    file_size: int
    mime_type: str

class ResourceSchema(ResourceCreate):
    id: str = Field(alias="_id")
    upload_date: datetime
    downloads: int = 0
    
    class Config:
        populate_by_name = True
