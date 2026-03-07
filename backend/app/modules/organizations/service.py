"""
Organizations service for IVEP.

Provides MongoDB storage and CRUD operations for organizations.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from bson import ObjectId

from app.db.utils import stringify_object_ids

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.organizations.schemas import OrganizationCreate, OrgMemberRole


def _id_query(oid) -> dict:
    s = str(oid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_organizations_collection() -> AsyncIOMotorCollection:
    """Get the organizations collection from MongoDB."""
    db = get_database()
    return db["organizations"]


def get_members_collection() -> AsyncIOMotorCollection:
    """Get the organization members collection from MongoDB."""
    db = get_database()
    return db["organization_members"]


async def create_organization(data: OrganizationCreate, owner_id) -> dict:
    """
    Create a new organization and add the creator as the owner.
    """
    now = datetime.now(timezone.utc)
    
    organization = {
        "name": data.name,
        "description": data.description,
        "owner_id": str(owner_id),
        "created_at": now,
        "industry": "General", 
        "website": None,
        "logo_url": None,
        "contact_email": None
    }
    
    org_coll = get_organizations_collection()
    result = await org_coll.insert_one(organization)
    organization["_id"] = result.inserted_id
    
    # Add owner as member
    await add_organization_member(
        organization_id=str(result.inserted_id),
        user_id=str(owner_id),
        role=OrgMemberRole.OWNER
    )
    
    return stringify_object_ids(organization)


async def get_organization_by_id(organization_id) -> Optional[dict]:
    """Get organization by _id."""
    collection = get_organizations_collection()
    doc = await collection.find_one(_id_query(organization_id))
    return stringify_object_ids(doc) if doc else None


async def list_organizations() -> list[dict]:
    """
    List all organizations.
    """
    collection = get_organizations_collection()
    cursor = collection.find({})
    docs = await cursor.to_list(length=100)
    return stringify_object_ids(docs)


async def add_organization_member(
    organization_id, 
    user_id, 
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
    existing = await collection.find_one({
        "user_id": str(user_id), 
        "organization_id": str(organization_id)
    })
    
    if existing:
        return stringify_object_ids(existing)

    await collection.insert_one(member)
    return stringify_object_ids(member)


async def get_organization_members(organization_id) -> list[dict]:
    """
    List members of an organization.
    """
    collection = get_members_collection()
    cursor = collection.find({"organization_id": str(organization_id)})
    docs = await cursor.to_list(length=100)
    return stringify_object_ids(docs)


async def update_organization_moderation(organization_id, **flags) -> Optional[dict]:
    """
    Admin: Set moderation flags on an organization.

    Accepted flags: is_verified, is_flagged, is_suspended (all bool).
    Only provided flags are updated; others are left unchanged.
    """
    from pymongo import ReturnDocument
    collection = get_organizations_collection()
    doc = await collection.find_one_and_update(
        _id_query(organization_id),
        {"$set": flags},
        return_document=ReturnDocument.AFTER,
    )
    return stringify_object_ids(doc) if doc else None

