"""
Users module router for IVEP.

Handles user-related endpoints including profile management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional

from app.core.dependencies import get_current_user, require_role
from app.modules.auth.enums import Role
from app.modules.users.schemas import UserRead, ProfileUpdate, UserCreate, ChangePasswordRequest
from app.modules.users.service import update_user_profile, list_all_users, set_user_active, create_user, get_user_by_email, change_password
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


@router.patch("/change-password")
async def change_user_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Change the authenticated user's password.
    Validates current password and sets new password.
    """
    user_id = str(current_user["_id"])

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    try:
        await change_password(user_id, payload.current_password, payload.new_password)
    except ValueError as e:
        if "incorrect" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    await log_audit(
        actor_id=user_id,
        action="user.change_password",
        entity="user",
        entity_id=user_id,
    )

    return {"message": "Password changed successfully"}


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


@router.post("/admin/create", response_model=UserRead)
async def admin_create_user(
    payload: UserCreate,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> UserRead:
    """
    Admin: Create a new user (e.g., another administrator).
    """
    # Fix M2: Validate role
    try:
        # payload.role might be a string, validate it against the Role enum
        Role(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")

    from app.core.security import hash_password
    from datetime import datetime, timezone
    
    # Check if user already exists
    if await get_user_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    user_data = payload.model_dump()
    user_data["hashed_password"] = hash_password(user_data.pop("password"))
    user_data["created_at"] = datetime.now(timezone.utc)
    
    # Default behavior for admin-created users
    user_data["is_active"] = True
    user_data["approval_status"] = "APPROVED"
    
    new_user = await create_user(user_data)
    
    await log_audit(
        actor_id=str(current_user["_id"]),
        action="user.create_admin" if payload.role == Role.ADMIN else "user.create",
        entity="user",
        entity_id=new_user["id"],
    )
    
    return UserRead(**new_user)

