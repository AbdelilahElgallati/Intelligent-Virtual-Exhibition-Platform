"""
Organizations service for IVEP.

Provides MongoDB storage and CRUD operations for organizations.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4
from bson import ObjectId

from app.db.utils import stringify_object_ids

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.organizations.schemas import OrganizationCreate, OrgMemberRole


def get_organizations_collection() -> AsyncIOMotorCollection:
    """Get the organizations collection from MongoDB."""
    db = get_database()
    return db["organizations"]


def get_members_collection() -> AsyncIOMotorCollection:
    """Get the organization members collection from MongoDB."""
    db = get_database()
    return db["organization_members"]


async def create_organization(data: OrganizationCreate, owner_id: UUID) -> dict:
    """
    Create a new organization and add the creator as the owner.
    """
    org_id = uuid4()
    now = datetime.now(timezone.utc)
    
    organization = {
        "id": str(org_id),
        "name": data.name,
        "description": data.description,
        "owner_id": str(owner_id),
        "created_at": now,
        # Add basic fields that might be useful for seeding/future
        "industry": "General", 
        "website": None,
        "logo_url": None,
        "contact_email": None
    }
    
    # Insert organization
    org_coll = get_organizations_collection()
    await org_coll.insert_one(organization)
    
    # Add owner as member
    await add_organization_member(
        organization_id=org_id,
        user_id=owner_id,
        role=OrgMemberRole.OWNER
    )
    
    return organization


async def get_organization_by_id(organization_id) -> Optional[dict]:
    """Get organization by ID (accepts uuid string or Mongo ObjectId)."""
    collection = get_organizations_collection()
    query = {"id": str(organization_id)}
    if ObjectId.is_valid(str(organization_id)):
        query = {"$or": [{"id": str(organization_id)}, {"_id": ObjectId(str(organization_id))}]}
    doc = await collection.find_one(query)
    return stringify_object_ids(doc) if doc else None


async def list_organizations() -> list[dict]:
    """
    List all organizations.
    """
    collection = get_organizations_collection()
    cursor = collection.find({})
    return await cursor.to_list(length=100)


async def add_organization_member(
    organization_id: UUID, 
    user_id: UUID, 
    role: OrgMemberRole = OrgMemberRole.MEMBER
) -> dict:
    """
    Add a user to an organization.
    """
    now = datetime.now(timezone.utc)
    
    member = {
        "user_id": str(user_id),
        "organization_id": str(organization_id),
        "role_in_org": role,
        "joined_at": now,
    }
    
    collection = get_members_collection()
    # Check if already exists? For now, just insert (dev/seed focus)
    # real app should check uniqueness of (user_id, organization_id)
    existing = await collection.find_one({
        "user_id": str(user_id), 
        "organization_id": str(organization_id)
    })
    
    if existing:
        return existing

    await collection.insert_one(member)
    return member


async def get_organization_members(organization_id: UUID) -> list[dict]:
    """
    List members of an organization.
    """
    collection = get_members_collection()
    cursor = collection.find({"organization_id": str(organization_id)})
    return await cursor.to_list(length=100)
