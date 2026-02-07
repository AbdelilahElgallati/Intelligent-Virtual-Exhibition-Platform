"""
Recommendations Router - ML-Powered Personalization.
Provides personalized recommendations for visitors, events, and enterprises.
"""
from fastapi import APIRouter, Depends, Body
from typing import List, Optional
from pydantic import BaseModel
from .schemas import RecommendationItem
from .recommendation_engine import hybrid_recommender
from ...core.dependencies import get_current_user

router = APIRouter()


class InteractionEvent(BaseModel):
    """Model for recording user interactions."""
    item_id: str
    item_type: str  # stand, event, resource
    interaction_type: str  # view, click, download, meeting, bookmark


class RecommendationRequest(BaseModel):
    """Request model for personalized recommendations."""
    user_history: Optional[List[dict]] = None
    top_k: int = 5


# Sample catalog data (in production, this would come from the database)
SAMPLE_STANDS = [
    {"id": "s1", "title": "AI Solutions Hub", "description": "Cutting-edge AI/ML products", "type": "stand", "tags": ["ai", "ml", "automation"]},
    {"id": "s2", "title": "Cloud Infrastructure", "description": "Enterprise cloud services", "type": "stand", "tags": ["cloud", "devops", "aws"]},
    {"id": "s3", "title": "CyberSec Solutions", "description": "Network security and compliance", "type": "stand", "tags": ["security", "compliance", "firewall"]},
    {"id": "s4", "title": "Data Analytics Pro", "description": "Business intelligence and analytics", "type": "stand", "tags": ["analytics", "bi", "data"]},
    {"id": "s5", "title": "IoT Innovations", "description": "Connected devices and sensors", "type": "stand", "tags": ["iot", "sensors", "embedded"]},
]

SAMPLE_EVENTS = [
    {"id": "e1", "title": "AI Summit 2024", "description": "Annual AI conference", "type": "event", "tags": ["ai", "conference", "networking"]},
    {"id": "e2", "title": "Cloud Expo", "description": "Cloud technology showcase", "type": "event", "tags": ["cloud", "expo", "enterprise"]},
    {"id": "e3", "title": "Security Conference", "description": "Cybersecurity trends and tools", "type": "event", "tags": ["security", "trends", "tools"]},
]

SAMPLE_RESOURCES = [
    {"id": "r1", "title": "RAG Implementation Guide", "description": "Building retrieval-augmented generation systems", "type": "resource", "tags": ["rag", "llm", "ai"]},
    {"id": "r2", "title": "Cloud Migration Playbook", "description": "Step-by-step cloud migration", "type": "resource", "tags": ["cloud", "migration", "devops"]},
    {"id": "r3", "title": "Zero Trust Security", "description": "Implementing zero trust architecture", "type": "resource", "tags": ["security", "zero-trust", "architecture"]},
]


@router.post("/track-interaction")
async def track_interaction(
    event: InteractionEvent,
    current_user: dict = Depends(get_current_user)
):
    """
    Track a user interaction for collaborative filtering.
    Call this when users view, click, download, or interact with items.
    """
    user_id = str(current_user.get("_id", "anonymous"))
    
    hybrid_recommender.record_interaction(
        user_id=user_id,
        item_id=event.item_id,
        interaction_type=event.interaction_type,
        metadata={"item_type": event.item_type}
    )
    
    return {"status": "tracked", "user_id": user_id, "item_id": event.item_id}


@router.get("/user/{user_id}", response_model=List[RecommendationItem])
async def get_user_recommendations(
    user_id: str,
    top_k: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """
    Get personalized recommendations for a visitor.
    Uses hybrid content-based + collaborative filtering.
    """
    # Get user's interaction history (simplified for demo)
    # In production, fetch from analytics/leads module
    user_history = [
        {"title": "AI Solutions", "description": "AI products", "tags": ["ai", "ml"]},
    ]
    
    # Combine all candidate items
    candidates = SAMPLE_STANDS + SAMPLE_EVENTS + SAMPLE_RESOURCES
    
    recommendations = hybrid_recommender.recommend(
        user_id=user_id,
        user_history=user_history,
        candidate_items=candidates,
        top_k=top_k
    )
    
    return recommendations


@router.post("/user/{user_id}/personalized", response_model=List[RecommendationItem])
async def get_personalized_recommendations(
    user_id: str,
    request: RecommendationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Get recommendations with custom user history.
    Allows passing explicit user preferences for more accurate recommendations.
    """
    candidates = SAMPLE_STANDS + SAMPLE_EVENTS + SAMPLE_RESOURCES
    
    recommendations = hybrid_recommender.recommend(
        user_id=user_id,
        user_history=request.user_history or [],
        candidate_items=candidates,
        top_k=request.top_k
    )
    
    return recommendations


@router.get("/events/{event_id}", response_model=List[RecommendationItem])
async def get_event_recommendations(
    event_id: str,
    top_k: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """
    Get recommended stands and resources for an event.
    Based on event themes and visitor interests.
    """
    # Use event as context for recommendations
    event_context = [item for item in SAMPLE_EVENTS if item["id"] == event_id]
    
    if not event_context:
        event_context = [{"title": "General Event", "tags": ["technology"]}]
    
    recommendations = hybrid_recommender.recommend(
        user_id=f"event_{event_id}",
        user_history=event_context,
        candidate_items=SAMPLE_STANDS + SAMPLE_RESOURCES,
        top_k=top_k
    )
    
    return recommendations


@router.get("/enterprise/{enterprise_id}", response_model=List[RecommendationItem])
async def get_enterprise_recommendations(
    enterprise_id: str,
    top_k: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """
    Get recommended leads/visitors for an enterprise stand.
    Helps exhibitors identify high-potential visitors.
    """
    # In production, this would analyze visitor behavior patterns
    # and match against enterprise's target profiles
    
    # Mock high-potential visitors
    potential_leads = [
        {"id": "v1", "title": "High Potential Lead", "type": "user", "description": "Interested in AI/ML solutions", "tags": ["enterprise", "ai"]},
        {"id": "v2", "title": "Sarah Wilson", "type": "user", "description": "CTO at TechCorp", "tags": ["decision-maker", "cloud"]},
        {"id": "v3", "title": "Marketing Director", "type": "user", "description": "Looking for analytics tools", "tags": ["marketing", "analytics"]},
    ]
    
    enterprise_profile = [{"title": "Enterprise Stand", "tags": ["b2b", "solutions"]}]
    
    recommendations = hybrid_recommender.recommend(
        user_id=f"enterprise_{enterprise_id}",
        user_history=enterprise_profile,
        candidate_items=potential_leads,
        top_k=top_k
    )
    
    return recommendations


@router.get("/similar/{item_type}/{item_id}", response_model=List[RecommendationItem])
async def get_similar_items(
    item_type: str,
    item_id: str,
    top_k: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """
    Get items similar to a specific item.
    Useful for "You might also like" sections.
    """
    # Find the reference item
    all_items = SAMPLE_STANDS + SAMPLE_EVENTS + SAMPLE_RESOURCES
    reference_item = next((i for i in all_items if i["id"] == item_id), None)
    
    if not reference_item:
        return []
    
    # Use reference item as history
    candidates = [i for i in all_items if i["id"] != item_id]
    
    recommendations = hybrid_recommender.recommend(
        user_id=f"similar_{item_id}",
        user_history=[reference_item],
        candidate_items=candidates,
        top_k=top_k
    )
    
    return recommendations
