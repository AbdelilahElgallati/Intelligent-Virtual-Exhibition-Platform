"""
Users module router for IVEP.

Handles user-related endpoints including profile management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional

from app.core.dependencies import get_current_user, require_role
from app.modules.auth.enums import Role
from app.modules.users.schemas import UserRead, ProfileUpdate
from app.modules.users.service import update_user_profile, list_all_users, set_user_active
from app.modules.audit.service import log_audit


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
) -> UserRead:
    return UserRead(**current_user)


@router.put("/me", response_model=UserRead)
async def update_my_profile(
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> UserRead:
    update_data = payload.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    user_id = str(current_user["_id"])
    updated_user = await update_user_profile(user_id, update_data)

    if updated_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserRead(**updated_user)


# ============== Admin Endpoints ==============

@router.get("/admin/all", response_model=list[UserRead])
async def admin_list_users(
    role: Optional[str] = Query(None, description="Filter by role: admin, organizer, visitor, enterprise"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> list[UserRead]:
    """
    Admin: List all users with optional role or search filter.
    """
    users = await list_all_users(role=role, search=search)
    return [UserRead(**u) for u in users]


@router.patch("/admin/{user_id}/activate", response_model=UserRead)
async def admin_activate_user(
    user_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> UserRead:
    """
    Admin: Activate a suspended user account.
    """
    updated = await set_user_active(user_id, is_active=True)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="user.activate",
        entity="user",
        entity_id=user_id,
    )
    return UserRead(**updated)


@router.patch("/admin/{user_id}/suspend", response_model=UserRead)
async def admin_suspend_user(
    user_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> UserRead:
    """
    Admin: Suspend a user account.
    """
    # Prevent admins from suspending themselves
    if str(user_id) == str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend your own account",
        )
    updated = await set_user_active(user_id, is_active=False)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="user.suspend",
        entity="user",
        entity_id=user_id,
    )
    return UserRead(**updated)
