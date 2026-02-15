"""
Users module router for IVEP.

Handles user-related endpoints including profile management.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.modules.users.schemas import UserRead, ProfileUpdate
from app.modules.users.service import update_user_profile


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
) -> UserRead:
    """
    Get current authenticated user's profile.
    
    Returns all profile fields including preferences and settings.
    """
    return UserRead(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user.get("username", ""),
        full_name=current_user.get("full_name", ""),
        role=current_user["role"],
        is_active=current_user.get("is_active", True),
        created_at=current_user.get("created_at"),
        # Profile fields
        bio=current_user.get("bio"),
        language=current_user.get("language"),
        avatar_url=current_user.get("avatar_url"),
        professional_info=current_user.get("professional_info"),
        interests=current_user.get("interests"),
        event_preferences=current_user.get("event_preferences"),
        networking_goals=current_user.get("networking_goals"),
        engagement_settings=current_user.get("engagement_settings"),
    )


@router.put("/me", response_model=UserRead)
async def update_my_profile(
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> UserRead:
    """
    Update current authenticated user's profile.
    
    Only provided fields are updated — omitted fields remain unchanged.
    """
    # Build update dict (skip None values to avoid overwriting with null)
    update_data = payload.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    user_id = str(current_user["id"])
    updated_user = await update_user_profile(user_id, update_data)

    if updated_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserRead(
        id=updated_user["id"],
        email=updated_user["email"],
        username=updated_user.get("username", ""),
        full_name=updated_user.get("full_name", ""),
        role=updated_user["role"],
        is_active=updated_user.get("is_active", True),
        created_at=updated_user.get("created_at"),
        bio=updated_user.get("bio"),
        language=updated_user.get("language"),
        avatar_url=updated_user.get("avatar_url"),
        professional_info=updated_user.get("professional_info"),
        interests=updated_user.get("interests"),
        event_preferences=updated_user.get("event_preferences"),
        networking_goals=updated_user.get("networking_goals"),
        engagement_settings=updated_user.get("engagement_settings"),
    )
