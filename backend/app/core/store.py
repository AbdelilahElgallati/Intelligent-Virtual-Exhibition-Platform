"""
In-memory data store for IVEP.

Provides fake data for development and testing.
"""

from datetime import datetime, timezone
from uuid import UUID

from app.core.security import hash_password
from app.modules.auth.schemas import Role


# In-memory user store
FAKE_USERS: dict[str, dict] = {
    "admin@ivep.com": {
        "id": UUID("11111111-1111-1111-1111-111111111111"),
        "email": "admin@ivep.com",
        "full_name": "Admin User",
        "hashed_password": hash_password("admin123"),
        "role": Role.ADMIN,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    },
    "organizer@ivep.com": {
        "id": UUID("22222222-2222-2222-2222-222222222222"),
        "email": "organizer@ivep.com",
        "full_name": "Organizer User",
        "hashed_password": hash_password("organizer123"),
        "role": Role.ORGANIZER,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    },
    "visitor@ivep.com": {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "email": "visitor@ivep.com",
        "full_name": "Visitor User",
        "hashed_password": hash_password("visitor123"),
        "role": Role.VISITOR,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    },
}


# In-memory organization store
FAKE_ORGANIZATIONS: dict[UUID, dict] = {}


# In-memory organization members store
FAKE_ORG_MEMBERS: list[dict] = []


def get_user_by_email(email: str) -> dict | None:
    """Get user by email from in-memory store."""
    return FAKE_USERS.get(email)


def get_user_by_id(user_id: UUID) -> dict | None:
    """Get user by ID from in-memory store."""
    for user in FAKE_USERS.values():
        if user["id"] == user_id:
            return user
    return None
