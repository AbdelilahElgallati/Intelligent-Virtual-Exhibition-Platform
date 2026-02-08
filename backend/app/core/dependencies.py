"""
Dependency injection module for IVEP backend.
Provides authentication and authorization dependencies for FastAPI routes.
"""

from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import ValidationError

from app.core.config import settings
from app.core.security import verify_token_type
from app.core.store import FAKE_ORGANIZATIONS, get_user_by_id
from app.modules.auth.schemas import Role
from app.modules.subscriptions.schemas import PLAN_FEATURES
from app.modules.subscriptions.service import get_plan
from app.modules.events.service import list_events
from app.db.mongo import get_database


# Security scheme
security = HTTPBearer()


# Get current authenticated user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Get the current authenticated user from JWT token.
    """

    token = credentials.credentials

    # Allow test token (useful for development)
    if token == "test-token":
        return {
            "_id": "visitor-456",
            "full_name": "Test User",
            "role": Role.VISITOR,
            "is_active": True,
        }

    # First try advanced token verification (new architecture)
    payload = verify_token_type(token, "access")

    # Fallback to direct JWT decode (legacy support)
    if payload is None:
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except (JWTError, ValidationError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Extract user ID
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Try in-memory store (new architecture)
    user = None
    try:
        user = get_user_by_id(UUID(user_id))
    except Exception:
        pass

    # Fallback to MongoDB lookup (legacy support)
    if user is None:
        db = get_database()
        user = await db.users.find_one({"_id": user_id})

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# Role-based authorization
def require_role(role: Role) -> Callable:
    """
    Dependency factory that requires a specific role.
    """

    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {role.value}",
            )
        return current_user

    return role_checker


def require_roles(roles: list[Role]) -> Callable:
    """
    Dependency factory that requires one of the specified roles.
    """

    async def roles_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            role_names = [r.value for r in roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {role_names}",
            )
        return current_user

    return roles_checker


# Subscription feature authorization
def require_feature(feature_name: str) -> Callable:
    """
    Dependency factory that requires a specific feature enabled in subscription.
    """

    async def feature_checker(current_user: dict = Depends(get_current_user)) -> dict:
        # Only relevant for organizers
        if current_user["role"] != Role.ORGANIZER:
            return current_user

        # Find organization owned by user (mock logic)
        org_id = None
        for org in FAKE_ORGANIZATIONS.values():
            if org["owner_id"] == current_user.get("id"):
                org_id = org["id"]
                break

        if not org_id:
            return current_user

        # Get plan & features
        plan = get_plan(org_id)
        features = PLAN_FEATURES.get(plan, {})

        # Numeric limit feature (example: max_events)
        if feature_name == "max_events":
            limit = features.get("max_events", 1)

            if limit == -1:  # unlimited
                return current_user

            events = list_events(organizer_id=current_user.get("id"))
            if len(events) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Feature limit reached: {feature_name}. Upgrade your plan.",
                )
            return current_user

        # Boolean feature check
        if not features.get(feature_name, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature access denied: {feature_name}. Upgrade your plan.",
            )

        return current_user

    return feature_checker
