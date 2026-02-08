"""
Dependency injection module for IVEP backend.

Provides authentication and authorization dependencies for FastAPI routes.
"""

from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import verify_token_type
from app.core.store import FAKE_ORGANIZATIONS, get_user_by_id
from app.modules.auth.schemas import Role
from app.modules.subscriptions.schemas import PLAN_FEATURES, SubscriptionPlan
from app.modules.subscriptions.service import get_plan


# HTTP Bearer token security scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Get the current authenticated user from JWT token.
    
    Args:
        credentials: HTTP Bearer credentials.
        
    Returns:
        dict: Current user data.
        
    Raises:
        HTTPException: If token is invalid or user not found.
    """
    token = credentials.credentials
    payload = verify_token_type(token, "access")
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_by_id(UUID(user_id))
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


def require_role(role: Role) -> Callable:
    """
    Dependency factory that requires a specific role.
    
    Args:
        role: Required role.
        
    Returns:
        Callable: Dependency function that checks the role.
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
    
    Args:
        roles: List of allowed roles.
        
    Returns:
        Callable: Dependency function that checks the roles.
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


def require_feature(feature_name: str) -> Callable:
    """
    Dependency factory that requires a specific feature enabled in subscription.
    
    Args:
        feature_name: Feature name to check.
        
    Returns:
        Callable: Dependency function that checks the feature.
    """
    async def feature_checker(current_user: dict = Depends(get_current_user)) -> dict:
        # Only relevant for organizers
        if current_user["role"] != Role.ORGANIZER:
            return current_user
            
        # Find organization owned by user (mock implementation: assumes 1 org per user for now)
        # In real app, organization_id would come from request or context
        org_id = None
        for org in FAKE_ORGANIZATIONS.values():
            if org["owner_id"] == current_user["id"]:
                org_id = org["id"]
                break
        
        if not org_id:
            # If no org, assume free plan limitations or skip if not relevant
            return current_user
            
        plan = get_plan(org_id)
        features = PLAN_FEATURES.get(plan, {})
        
        # Check numeric limits (special case for max_events)
        if feature_name == "max_events":
            limit = features.get("max_events", 1)
            if limit == -1:  # Unlimited
                return current_user
                
            # Count existing events
            from app.modules.events.service import list_events
            events = list_events(organizer_id=current_user["id"])
            if len(events) >= limit:
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Feature limit reached: {feature_name}. Upgrade your plan.",
                )
            return current_user

        # Check boolean features
        if not features.get(feature_name, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature access denied: {feature_name}. Upgrade your plan.",
            )
            
        return current_user
    return feature_checker
