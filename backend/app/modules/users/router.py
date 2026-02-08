"""
Users module router for IVEP.

Handles user-related endpoints.
"""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.modules.users.schemas import UserRead


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
) -> UserRead:
    """
    Get current authenticated user's profile.
    
    Returns:
        UserRead: Current user data (no password).
    """
    return UserRead(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        is_active=current_user["is_active"],
        created_at=current_user["created_at"],
    )
