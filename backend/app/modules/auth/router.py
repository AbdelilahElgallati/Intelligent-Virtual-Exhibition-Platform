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
from app.core.store import get_user_by_email
from app.modules.auth.schemas import LoginRequest, Role, TokenResponse


router = APIRouter(prefix="/auth", tags=["Authentication"])


class RefreshRequest(BaseModel):
    """Schema for token refresh request."""
    refresh_token: str


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest) -> TokenResponse:
    """
    Authenticate user and return tokens.
    
    Args:
        request: Login credentials.
        
    Returns:
        TokenResponse: Access and refresh tokens.
        
    Raises:
        HTTPException: If credentials are invalid.
    """
    user = get_user_by_email(request.email)
    
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
    
    # Create tokens with user ID as subject
    token_data = {"sub": str(user["id"]), "role": user["role"].value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest) -> TokenResponse:
    """
    Refresh access token using refresh token.
    
    Args:
        request: Refresh token request.
        
    Returns:
        TokenResponse: New access and refresh tokens.
        
    Raises:
        HTTPException: If refresh token is invalid.
    """
    payload = verify_token_type(request.refresh_token, "refresh")
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    
    # Create new tokens
    token_data = {"sub": payload["sub"], "role": payload["role"]}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
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
