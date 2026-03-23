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
from app.modules.users.service import get_user_by_email, create_user, get_user_by_id
from app.modules.auth.schemas import LoginRequest, Role, TokenResponse, RegisterRequest
from app.modules.users.schemas import UserRead
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
        approval = user.get("approval_status")
        if approval == "PENDING_APPROVAL":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is pending admin approval. You will be able to log in once approved.",
            )
        elif approval == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account registration was rejected. Please contact support.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
        )
    
    # Create tokens with user _id and role
    token_data = {"sub": str(user["_id"]), "role": user["role"]}
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
    
    # Create new user — let MongoDB generate _id
    from app.core.security import hash_password
    
    is_organizer = request.role == Role.ORGANIZER
    is_enterprise = request.role == Role.ENTERPRISE
    needs_approval = is_organizer or is_enterprise
    user_data = {
        "email": request.email,
        "username": request.username,
        "full_name": request.full_name,
        "hashed_password": hash_password(request.password),
        "role": request.role,
        # Organizers and enterprises start as pending until admin approves
        "is_active": not needs_approval,
        "approval_status": "PENDING_APPROVAL" if needs_approval else None,
        "created_at": datetime.now(timezone.utc),
        # Organizer profile data (stored for admin review)
        **({
            "org_name": request.org_name,
            "org_type": request.org_type,
            "org_country": request.org_country,
            "org_city": request.org_city,
            "org_phone": request.org_phone,
            "org_website": request.org_website,
            "org_professional_email": request.org_professional_email,
        } if is_organizer else {}),
        # Enterprise profile data (mirrored on user for admin review and simpler queries)
        **({
            "company_name": request.company_name,
            "professional_email": request.professional_email,
            "industry": request.industry,
            "description": request.description,
            "country": request.country,
            "city": request.city,
            "creation_year": request.creation_year,
            "company_size": request.company_size,
            "website": request.website,
            "linkedin": request.linkedin,
        } if is_enterprise else {}),
    }
    
    user = await create_user(user_data)
    
    # Special logic for ENTERPRISE role: Create an organization automatically
    if request.role == Role.ENTERPRISE:
        from app.modules.organizations.service import create_organization
        from app.modules.organizations.schemas import OrganizationCreate
        
        if not request.company_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Company name is required for enterprise registration",
            )
            
        org_data = OrganizationCreate(
            name=request.company_name,
            description=request.description
        )
        
        # Create organization and link user as owner
        org = await create_organization(org_data, owner_id=user["_id"])
        
        # Update organization with additional enterprise fields
        from app.modules.organizations.service import get_organizations_collection
        org_coll = get_organizations_collection()
        from bson import ObjectId
        await org_coll.update_one(
            {"_id": ObjectId(org["id"])},
            {"$set": {
                "type": "enterprise",
                "industry": request.industry,
                "professional_email": request.professional_email,
                "contact_email": request.professional_email,
                "country": request.country,
                "city": request.city,
                "creation_year": request.creation_year,
                "company_size": request.company_size,
                "website": request.website,
                "linkedin": request.linkedin,
            }}
        )

    # Organizer and enterprise accounts start inactive — re-fetch to get DB state
    if needs_approval:
        user = await get_user_by_email(request.email) or user

    # Create tokens using the MongoDB-generated _id
    token_data = {"sub": str(user["_id"]), "role": request.role.value}
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
    user = await get_user_by_id(payload["sub"])
    
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    token_data = {"sub": payload["sub"], "role": payload["role"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        token_type="bearer",
        user=UserRead(**user)
    )


# ============== RBAC Test Routes ==============

@router.get("/admin-only")
async def admin_only_route(
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> dict:
    return {
        "message": "Welcome, Admin!",
        "user_id": str(current_user["_id"]),
        "role": current_user["role"].value,
    }


@router.get("/organizer-only")
async def organizer_only_route(
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
) -> dict:
    return {
        "message": "Welcome, Organizer!",
        "user_id": str(current_user["_id"]),
        "role": current_user["role"].value,
    }
