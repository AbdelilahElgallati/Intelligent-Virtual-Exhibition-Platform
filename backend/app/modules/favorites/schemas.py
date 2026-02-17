from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

FavoriteTarget = Literal["event", "stand", "organization"]


class FavoriteCreate(BaseModel):
    target_type: FavoriteTarget
    target_id: str

    model_config = {"from_attributes": True}


class FavoriteRead(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    target_type: FavoriteTarget
    target_id: str
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
