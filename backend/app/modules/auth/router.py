"""
Auth module router for IVEP.

Handles authentication endpoints: login, refresh, and protected test routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user, require_role
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    verify_token_type,
)
from app.modules.users.service import get_user_by_email, create_user
from app.modules.auth.schemas import LoginRequest, Role, TokenResponse, RegisterRequest
from app.modules.users.schemas import UserRead
import uuid
from datetime import datetime, timezone


router = APIRouter(prefix="/auth", tags=["Authentication"])


class RefreshRequest(BaseModel):
    """Schema for token refresh request."""
    refresh_token: str


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest) -> TokenResponse:
    """
    Authenticate user and return tokens.
    """
    user = await get_user_by_email(request.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    if not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
        )
    
    # Create tokens with user ID and role
    token_data = {"sub": str(user["id"]), "role": user["role"]}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserRead(**user)
    )


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest) -> TokenResponse:
    """
    Register a new user and return tokens.
    """
    if await get_user_by_email(request.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create new user
    from app.core.security import hash_password
    
    user_id = uuid.uuid4()
    user = {
        "id": user_id,
        "email": request.email,
        "username": request.username,
        "full_name": request.full_name,
        "hashed_password": hash_password(request.password),
        "role": request.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    
    await create_user(user)
    
    # Create tokens
    token_data = {"sub": str(user_id), "role": request.role.value}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserRead(**user)
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest) -> TokenResponse:
    payload = verify_token_type(request.refresh_token, "refresh")
    
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Fetch the user to include in the response
    user = await get_user_by_id(payload["sub"]) # You need to implement/import this
    
    token_data = {"sub": payload["sub"], "role": payload["role"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        token_type="bearer",
        user=UserRead(**user) # This field is REQUIRED by your schema
    )


# ============== RBAC Test Routes ==============

@router.get("/admin-only")
async def admin_only_route(
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> dict:
    """
    Admin-only protected route.
    
    Returns:
        dict: Success message with user info.
    """
    return {
        "message": "Welcome, Admin!",
        "user_id": str(current_user["id"]),
        "role": current_user["role"].value,
    }


@router.get("/organizer-only")
async def organizer_only_route(
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> dict:
    """
    Organizer-only protected route.
    
    Returns:
        dict: Success message with user info.
    """
    return {
        "message": "Welcome, Organizer!",
        "user_id": str(current_user["id"]),
        "role": current_user["role"].value,
    }
