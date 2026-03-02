"""
Participant service for IVEP.

Provides MongoDB-backed participant storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.participants.schemas import ParticipantStatus
from app.db.utils import stringify_object_ids


def _id_query(pid) -> dict:
    s = str(pid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_participants_collection() -> AsyncIOMotorCollection:
    """Get the participants collection from MongoDB."""
    db = get_database()
    return db["participants"]


async def invite_participant(event_id, user_id) -> dict:
    """
    Invite a user to an event.
    """
    now = datetime.now(timezone.utc)

    participant = {
        "event_id": str(event_id),
        "user_id": str(user_id),
        "status": ParticipantStatus.INVITED,
        "created_at": now,
    }

    collection = get_participants_collection()
    result = await collection.insert_one(participant)
    participant["_id"] = result.inserted_id
    return stringify_object_ids(participant)

async def request_to_join(event_id, user_id) -> dict:
    """
    Request to join an event.
    """
    now = datetime.now(timezone.utc)

    participant = {
        "event_id": str(event_id),
        "user_id": str(user_id),
        "status": ParticipantStatus.REQUESTED,
        "created_at": now,
    }

    collection = get_participants_collection()
    result = await collection.insert_one(participant)
    participant["_id"] = result.inserted_id
    return stringify_object_ids(participant)

async def get_participant_by_id(participant_id) -> Optional[dict]:
    """Get participant by _id."""
    collection = get_participants_collection()
    doc = await collection.find_one(_id_query(participant_id))
    return stringify_object_ids(doc) if doc else None

async def get_user_participation(event_id, user_id) -> Optional[dict]:
    """Get participant record for a specific user and event."""
    collection = get_participants_collection()
    doc = await collection.find_one({
        "event_id": str(event_id),
        "user_id": str(user_id)
    })
    return stringify_object_ids(doc) if doc else None

async def list_event_participants(event_id) -> List[dict]:
    """List all participants for an event."""
    collection = get_participants_collection()
    cursor = collection.find({"event_id": str(event_id)})
    docs = await cursor.to_list(length=1000)
    return stringify_object_ids(docs)

async def approve_participant(participant_id) -> Optional[dict]:
    """
    Approve a participant.
    """
    collection = get_participants_collection()
    updated = await collection.find_one_and_update(
        _id_query(participant_id),
        {"$set": {"status": ParticipantStatus.APPROVED}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None

async def reject_participant(participant_id) -> Optional[dict]:
    """
    Reject a participant.
    """
    collection = get_participants_collection()
    updated = await collection.find_one_and_update(
        _id_query(participant_id),
        {"$set": {"status": ParticipantStatus.REJECTED}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def reject_participant_with_reason(participant_id, reason: Optional[str] = None) -> Optional[dict]:
    """
    Reject a participant and optionally store a rejection reason.
    """
    collection = get_participants_collection()
    update_fields: dict = {"status": ParticipantStatus.REJECTED}
    if reason:
        update_fields["rejection_reason"] = reason
    updated = await collection.find_one_and_update(
        _id_query(participant_id),
        {"$set": update_fields},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def list_enterprise_requests(
    event_id: str,
    status: str = "requested",
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """
    Admin: List enterprise join requests for an event, enriched with user,
    organization, subscription, and participation history data.

    Returns: { items, total, skip, limit }
    """
    db = get_database()
    participants_col = db["participants"]
    users_col = db["users"]
    org_members_col = db["organization_members"]
    organizations_col = db["organizations"]
    # subscriptions_col = db["subscriptions"]  # subscription plan disabled

    # 1. Fetch participants for the event with the requested status
    query: dict = {"event_id": str(event_id), "status": status}
    all_participants = await participants_col.find(query).to_list(length=1000)
    all_participants = stringify_object_ids(all_participants)

    # 2. Enrich each participant record
    items = []
    for p in all_participants:
        user_id = p.get("user_id")

        # Fetch user (must have role=enterprise)
        uid = user_id
        if ObjectId.is_valid(str(uid)):
            user_doc = await users_col.find_one({
                "_id": ObjectId(str(uid)),
                "role": "enterprise",
            })
        else:
            user_doc = await users_col.find_one({
                "_id": uid,
                "role": "enterprise",
            })

        if not user_doc:
            # Skip non-enterprise requesters
            continue

        user_doc = stringify_object_ids(user_doc)

        # Apply search filter (by org name / email) — pre-filter here
        email = user_doc.get("email", "")
        full_name = user_doc.get("full_name", "")

        # Fetch organization via org_members
        member_doc = await org_members_col.find_one({"user_id": str(user_id)})
        org_doc = None

        if member_doc:
            org_id = member_doc.get("organization_id")
            if org_id:
                org_doc = await organizations_col.find_one(_id_query(org_id))
                if org_doc:
                    org_doc = stringify_object_ids(org_doc)

                # Apply search filter against org name
                if search:
                    search_lower = search.lower()
                    name_match = search_lower in (org_doc.get("name", "") if org_doc else "").lower()
                    email_match = search_lower in email.lower()
                    name_full_match = search_lower in full_name.lower()
                    if not (name_match or email_match or name_full_match):
                        continue

                # Subscription lookup disabled
                # sub_doc = await subscriptions_col.find_one({"organization_id": str(org_id)})
        else:
            # No org — apply search against user email/name
            if search:
                search_lower = search.lower()
                if search_lower not in email.lower() and search_lower not in full_name.lower():
                    continue

        # Participation history: count approved participations for this user across all events
        history_cursor = participants_col.find({
            "user_id": str(user_id),
            "status": "approved",
        })
        history_docs = await history_cursor.to_list(length=1000)

        total_approved = len(history_docs)
        last_event_id = None
        last_event_date = None
        if history_docs:
            # Sort descending by created_at to find the latest
            sorted_history = sorted(
                history_docs,
                key=lambda d: d.get("created_at", datetime.min.replace(tzinfo=timezone.utc)),
                reverse=True,
            )
            last_event_id = sorted_history[0].get("event_id")
            last_event_date = sorted_history[0].get("created_at")

        # Build enriched item
        item = {
            "participant": {
                "id": p.get("id") or p.get("_id"),
                "status": p.get("status"),
                "created_at": p.get("created_at"),
                "user_id": str(user_id),
                "rejection_reason": p.get("rejection_reason"),
            },
            "user": {
                "id": user_doc.get("id") or user_doc.get("_id"),
                "full_name": user_doc.get("full_name"),
                "email": email,
                "is_active": user_doc.get("is_active", True),
            },
            "organization": {
                "id": org_doc.get("id") or org_doc.get("_id"),
                "name": org_doc.get("name"),
                "description": org_doc.get("description"),
                "industry": org_doc.get("industry"),
            } if org_doc else None,
            # "subscription": None,  # subscription plan disabled
            "history": {
                "total_approved": total_approved,
                "last_event_id": last_event_id,
                "last_event_date": last_event_date,
            },
        }
        items.append(item)

    total = len(items)
    # Apply pagination after filtering
    paginated = items[skip: skip + limit]

    return {
        "items": paginated,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

async def get_joined_events(user_id) -> List[dict]:
    """Get events where user is an APPROVED participant."""
    collection = get_participants_collection()
    cursor = collection.find({
        "user_id": str(user_id),
        "status": ParticipantStatus.APPROVED,
    })
    docs = await cursor.to_list(length=1000)
    return stringify_object_ids(docs)
