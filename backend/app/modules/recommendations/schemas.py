from pydantic import BaseModel
from typing import List, Optional

class RecommendationItem(BaseModel):
    id: str
    title: str
    type: str # event, stand, resource
    score: float
    reason: Optional[str] = None
    image_url: Optional[str] = None
