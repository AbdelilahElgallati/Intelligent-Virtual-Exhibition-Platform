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
        "status": ParticipantStatus.INVITED.value,
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
        "status": ParticipantStatus.REQUESTED.value,
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

async def get_user_participation(event_id: str, user_id: Optional[str] = None, organization_id: Optional[str] = None) -> Optional[dict]:
    """Get participant record for a specific user OR organization and event."""
    collection = get_participants_collection()
    query = {"event_id": str(event_id)}
    if user_id:
        query["user_id"] = str(user_id)
    if organization_id:
        query["organization_id"] = str(organization_id)
        
    doc = await collection.find_one(query)
    return stringify_object_ids(doc) if doc else None

async def list_event_participants(event_id) -> List[dict]:
    """List all participants for an event."""
    collection = get_participants_collection()
    cursor = collection.find({"event_id": str(event_id)})
    docs = await cursor.to_list(length=1000)
    return stringify_object_ids(docs)


async def list_event_attendees(event_id: str) -> List[dict]:
    """List approved participants enriched with public user profile info."""
    db = get_database()
    participants_col = get_participants_collection()
    users_col = db["users"]
    org_members_col = db["organization_members"]
    organizations_col = db["organizations"]

    cursor = participants_col.find({
        "event_id": str(event_id),
        "status": {"$in": [ParticipantStatus.APPROVED.value, ParticipantStatus.GUEST_APPROVED.value]},
    })
    participants = await cursor.to_list(length=1000)
    participants = stringify_object_ids(participants)

    items: List[dict] = []
    for p in participants:
        user_id = p.get("user_id")
        uid = str(user_id)
        user_doc = await users_col.find_one(
            {"_id": ObjectId(uid)} if ObjectId.is_valid(uid) else {"_id": uid}
        )
        if not user_doc:
            continue
        user_doc = stringify_object_ids(user_doc)

        # Fetch organization
        org_info = None
        member_doc = await org_members_col.find_one({"user_id": uid})
        if member_doc:
            org_id = member_doc.get("organization_id")
            if org_id:
                org_doc = await organizations_col.find_one(_id_query(org_id))
                if org_doc:
                    org_doc = stringify_object_ids(org_doc)
                    org_info = {
                        "name": org_doc.get("name"),
                        "industry": org_doc.get("industry"),
                        "website": org_doc.get("website"),
                        "contact_email": org_doc.get("contact_email"),
                        "contact_phone": org_doc.get("contact_phone"),
                        "city": org_doc.get("city"),
                        "country": org_doc.get("country"),
                    }

        prof = user_doc.get("professional_info") or {}
        event_prefs = user_doc.get("event_preferences") or {}
        items.append({
            "id": user_doc.get("id") or user_doc.get("_id"),
            "full_name": user_doc.get("full_name"),
            "email": user_doc.get("email"),
            "avatar_url": user_doc.get("avatar_url"),
            "role": user_doc.get("role"),
            "bio": user_doc.get("bio"),
            "job_title": prof.get("job_title"),
            "experience_level": prof.get("experience_level"),
            "company": prof.get("company") or (org_info.get("name") if org_info else None),
            "industry": prof.get("industry") or (org_info.get("industry") if org_info else None),
            "language": user_doc.get("language"),
            "timezone": user_doc.get("timezone"),
            "preferred_event_types": event_prefs.get("types") or [],
            "preferred_languages": event_prefs.get("languages") or [],
            "preferred_regions": event_prefs.get("regions") or [],
            "org_name": org_info.get("name") if org_info else None,
            "org_type": user_doc.get("org_type"),
            "org_website": org_info.get("website") if org_info else None,
            "org_contact_email": org_info.get("contact_email") if org_info else None,
            "org_contact_phone": org_info.get("contact_phone") if org_info else None,
            "org_city": org_info.get("city") if org_info else user_doc.get("org_city"),
            "org_country": org_info.get("country") if org_info else user_doc.get("org_country"),
            "interests": user_doc.get("interests") or [],
            "networking_goals": user_doc.get("networking_goals") or [],
        })
    return items

async def approve_participant(participant_id, target_status: ParticipantStatus | str = ParticipantStatus.APPROVED.value) -> Optional[dict]:
    """
    Approve a participant (or move to a provided target status).
    """
    status_value = target_status.value if isinstance(target_status, ParticipantStatus) else str(target_status)
    collection = get_participants_collection()
    updated = await collection.find_one_and_update(
        _id_query(participant_id),
        {"$set": {"status": status_value, "updated_at": datetime.now(timezone.utc)}},
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
        {"$set": {"status": ParticipantStatus.REJECTED.value}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def reject_participant_with_reason(participant_id, reason: Optional[str] = None) -> Optional[dict]:
    """
    Reject a participant and optionally store a rejection reason.
    """
    collection = get_participants_collection()
    update_fields: dict = {"status": ParticipantStatus.REJECTED.value}
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
    status: str = "pending_admin_approval",
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

    async def _find_user_doc_by_ref(user_ref: Optional[str]) -> Optional[dict]:
        if not user_ref:
            return None
        ref = str(user_ref)
        queries = []
        if ObjectId.is_valid(ref):
            queries.append({"_id": ObjectId(ref)})
        queries.append({"_id": ref})
        queries.append({"id": ref})

        for q in queries:
            found = await users_col.find_one(q)
            if found:
                return found
        return None

    # 1. Fetch participants for the event with the requested status
    query: dict = {
        "event_id": str(event_id),
        "status": status,
        "role": "enterprise",
    }
    all_participants = await participants_col.find(query).to_list(length=1000)
    all_participants = stringify_object_ids(all_participants)

    # 2. Enrich each participant record
    items = []
    for p in all_participants:
        user_id = str(p.get("user_id") or "")
        # Try direct user reference first.
        user_doc = await _find_user_doc_by_ref(user_id)

        # Resolve organization primarily from participant payload.
        org_doc = None
        participant_org_id = str(p.get("organization_id") or "")
        if participant_org_id:
            org_doc = await organizations_col.find_one(_id_query(participant_org_id))
            if not org_doc:
                org_doc = await organizations_col.find_one({"id": participant_org_id})

        # Fallback organization lookup via membership or owner links.
        member_doc = None
        if not org_doc and user_id:
            member_doc = await org_members_col.find_one({"user_id": str(user_id)})
            if not member_doc and ObjectId.is_valid(user_id):
                member_doc = await org_members_col.find_one({"user_id": ObjectId(user_id)})
            if member_doc:
                org_id = member_doc.get("organization_id")
                if org_id:
                    org_doc = await organizations_col.find_one(_id_query(org_id))
                    if not org_doc:
                        org_doc = await organizations_col.find_one({"id": str(org_id)})
        if not org_doc and user_id:
            org_doc = await organizations_col.find_one({"owner_id": str(user_id)})

        if user_doc:
            # Keep only enterprise requesters (supports enum/string variations).
            role_value = user_doc.get("role")
            if hasattr(role_value, "value"):
                role_value = role_value.value
            role_normalized = str(role_value or "").strip().lower()
            if role_normalized != "enterprise":
                continue

        # If user ref is stale/missing, recover user via organization owner/member.
        if not user_doc and org_doc:
            owner_ref = str(org_doc.get("owner_id") or org_doc.get("created_by") or "")
            user_doc = await _find_user_doc_by_ref(owner_ref)
            if not user_doc:
                org_id = str(org_doc.get("_id") or org_doc.get("id") or "")
                if org_id:
                    owner_member = await org_members_col.find_one({
                        "organization_id": org_id,
                        "$or": [{"role": "owner"}, {"role": "OWNER"}],
                    })
                    if not owner_member and ObjectId.is_valid(org_id):
                        owner_member = await org_members_col.find_one({
                            "organization_id": ObjectId(org_id),
                            "$or": [{"role": "owner"}, {"role": "OWNER"}],
                        })
                    if owner_member:
                        user_doc = await _find_user_doc_by_ref(str(owner_member.get("user_id") or ""))
                    if not user_doc:
                        any_member = await org_members_col.find_one({"organization_id": org_id})
                        if not any_member and ObjectId.is_valid(org_id):
                            any_member = await org_members_col.find_one({"organization_id": ObjectId(org_id)})
                        if any_member:
                            user_doc = await _find_user_doc_by_ref(str(any_member.get("user_id") or ""))
            if user_doc:
                user_id = str(user_doc.get("id") or user_doc.get("_id") or user_id)

        if org_doc:
            org_doc = stringify_object_ids(org_doc)

        user_doc = stringify_object_ids(user_doc)

        # Apply search filter (by org name / email) — pre-filter here
        email = (user_doc or {}).get("email", "")
        full_name = (user_doc or {}).get("full_name", "")

        # Apply search filter against org name/email/full name
        if search:
            search_lower = search.lower()
            name_match = search_lower in (org_doc.get("name", "") if org_doc else "").lower()
            email_match = search_lower in email.lower()
            name_full_match = search_lower in full_name.lower()
            if not (name_match or email_match or name_full_match):
                continue

        if not member_doc and not org_doc:
            # No org — apply search against user email/name
            if search:
                search_lower = search.lower()
                if search_lower not in email.lower() and search_lower not in full_name.lower():
                    continue

        # Participation history: count approved participations for this user across all events
        history_cursor = participants_col.find({
            "user_id": str(user_id),
            "status": {"$in": [ParticipantStatus.APPROVED.value, ParticipantStatus.GUEST_APPROVED.value]},
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
                "id": (user_doc or {}).get("_id") or (user_doc or {}).get("id") or str(user_id),
                "full_name": (user_doc or {}).get("full_name") or (org_doc or {}).get("name") or "Unknown enterprise user",
                "email": email or (org_doc or {}).get("contact_email") or "unknown@enterprise.local",
                "is_active": (user_doc or {}).get("is_active", True),
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
    """Get events where user is an accepted participant."""
    collection = get_participants_collection()
    cursor = collection.find({
        "user_id": str(user_id),
        "status": {"$in": [ParticipantStatus.APPROVED.value, ParticipantStatus.GUEST_APPROVED.value]},
    })
    docs = await cursor.to_list(length=1000)
    return stringify_object_ids(docs)
