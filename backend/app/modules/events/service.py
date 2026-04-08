"""
Event service for IVEP.

Provides MongoDB-backed event storage and CRUD operations.
"""

import re
import secrets
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence

from bson import ObjectId

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.mongo import get_database
from app.modules.events.schemas import EventCreate, EventState, EventUpdate
from app.db.utils import stringify_object_ids
from app.core.storage import delete_managed_upload_by_url

# Price per enterprise per event day (configurable)
PRICE_PER_ENTERPRISE_PER_DAY: float = 50.0


def _slugify(text: str) -> str:
    """Convert any string into a URL-safe kebab-case slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)   # strip non-word chars
    text = re.sub(r"[\s_]+", "-", text)     # spaces/underscores → hyphens
    text = re.sub(r"-+", "-", text)          # collapse multiple hyphens
    return text[:60].strip("-")


def _id_query(eid) -> dict:
    """Build a query dict that matches _id (ObjectId or string)."""
    s = str(eid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_events_collection() -> AsyncIOMotorCollection:
    """Get the events collection from MongoDB."""
    db = get_database()
    return db["events"]


def _calculate_payment(num_enterprises: int, start_date: datetime, end_date: datetime) -> float:
    """Auto-calculate payment: enterprises × days × rate."""
    delta = end_date - start_date
    days = max(1, delta.days + (1 if delta.seconds > 0 else 0))
    return round(num_enterprises * days * PRICE_PER_ENTERPRISE_PER_DAY, 2)


def _normalize_money(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


async def create_event(data: EventCreate, organizer_id) -> dict:
    """
    Submit a new event request — goes directly to PENDING_APPROVAL state.
    """
    now = datetime.now(timezone.utc)

    event = {
        "title": data.title,
        "description": data.description,
        "organizer_id": str(organizer_id),
        "state": EventState.PENDING_APPROVAL,
        "banner_url": data.banner_url,
        "category": data.category or "Exhibition",
        "start_date": data.start_date or now,
        "end_date": data.end_date or now,
        "event_timezone": data.event_timezone or "UTC",
        "location": data.location or "Virtual Platform",
        "tags": data.tags or [],
        "organizer_name": data.organizer_name,
        "created_at": now,
        # New required request fields
        "num_enterprises": data.num_enterprises,
        "event_timeline": data.event_timeline,
        "extended_details": data.extended_details,
        "additional_info": data.additional_info,
        # Pricing fields (set by organizer)
        "stand_price": _normalize_money(data.stand_price),
        "is_paid": data.is_paid,
        "ticket_price": _normalize_money(data.ticket_price) if data.is_paid else None,
        # Payment & links (set later)
        "payment_amount": None,
        "enterprise_link": None,
        "visitor_link": None,
        "publicity_link": None,
        "enterprise_invite_token": None,
        "visitor_invite_token": None,
        "rejection_reason": None,
        # Structured schedule
        "schedule_days": [d.model_dump() for d in data.schedule_days] if data.schedule_days else None,
    }

    collection = get_events_collection()
    result = await collection.insert_one(event)
    event["_id"] = result.inserted_id

    # Auto-generate a URL-safe slug: title-slug + 4-char hex from the new _id
    # The suffix guarantees uniqueness even when two events share the same title.
    base_slug = _slugify(data.title)
    short_suffix = str(result.inserted_id)[-4:]
    slug = f"{base_slug}-{short_suffix}" if base_slug else short_suffix
    await collection.update_one({"_id": result.inserted_id}, {"$set": {"slug": slug}})
    event["slug"] = slug

    return stringify_object_ids(event)


async def get_event_by_id(event_id) -> Optional[dict]:
    """
    Get event by ID (_id) **or slug**.

    Accepts a MongoDB ObjectId string OR a human-readable slug so that
    all existing callers automatically support slug-based resolution
    without any further changes.
    """
    collection = get_events_collection()
    # 1. Try ObjectId lookup first (fastest path for internal callers)
    if ObjectId.is_valid(str(event_id)):
        doc = await collection.find_one({"_id": ObjectId(str(event_id))})
        if doc:
            return stringify_object_ids(doc)
    # 2. Fall back to slug lookup (public URL path, e.g. "tech-summit-2025-ab3f")
    doc = await collection.find_one({"slug": str(event_id)})
    return stringify_object_ids(doc) if doc else None


async def resolve_event_id(slug_or_id: str) -> str:
    """Helper for sub-routers: resolve an event slug to its true ObjectId string."""
    if not slug_or_id:
        return ""
    if ObjectId.is_valid(str(slug_or_id)):
        return str(slug_or_id)
    collection = get_events_collection()
    doc = await collection.find_one({"slug": str(slug_or_id)}, {"_id": 1})
    if not doc:
        return str(slug_or_id)  # let it fail downstream
    return str(doc["_id"])


async def list_events(
    organizer_id: Optional[str] = None,
    state: Optional[EventState | Sequence[EventState]] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    """
    List all events with optional filters.
    """
    collection = get_events_collection()
    query = {}
    
    if organizer_id:
        query["organizer_id"] = str(organizer_id)
    
    if state:
        if isinstance(state, (list, tuple, set)):
            query["state"] = {"$in": [getattr(s, "value", s) for s in state]}
        else:
            query["state"] = getattr(state, "value", state)

    if category:
        query["category"] = category

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = collection.find(query)
    events = await cursor.to_list(length=100)
    return stringify_object_ids(events)


async def update_event(event_id, data: EventUpdate) -> Optional[dict]:
    """
    Update an event's fields.
    Only non-None values from the payload are applied.
    """
    collection = get_events_collection()
    update_data = dict(data.model_dump(exclude_none=True).items())

    if "stand_price" in update_data:
        update_data["stand_price"] = _normalize_money(update_data.get("stand_price"))
    if "ticket_price" in update_data:
        update_data["ticket_price"] = _normalize_money(update_data.get("ticket_price"))
    
    if not update_data:
        return await get_event_by_id(event_id)

    existing = await collection.find_one(_id_query(event_id))
    if not existing:
        return None

    previous_banner_url = existing.get("banner_url")
    banner_changed = "banner_url" in update_data and update_data.get("banner_url") != previous_banner_url
    
    result = await collection.find_one_and_update(
        _id_query(event_id),
        {"$set": update_data},
        return_document=True,
    )
    updated = stringify_object_ids(result) if result else None

    if updated and banner_changed and previous_banner_url:
        delete_managed_upload_by_url(previous_banner_url)

    return updated


async def delete_event(event_id) -> bool:
    """
    Delete an event and all associated data (cascade).
    """
    db = get_database()
    collection = db["events"]
    
    # 1. Delete the event document
    result = await collection.delete_one(_id_query(event_id))
    if result.deleted_count == 0:
        return False

    # 2. Cascade delete associated data
    eid_str = str(event_id)
    
    # Collection names based on project audit
    await db["stands"].delete_many({"event_id": eid_str})
    await db["participants"].delete_many({"event_id": eid_str})
    await db["meetings"].delete_many({"event_id": eid_str})
    await db["leads"].delete_many({"event_id": eid_str})
    await db["notifications"].delete_many({"event_id": eid_str})
    
    return True


async def update_event_state(event_id, state: EventState) -> Optional[dict]:
    """
    Update event state.
    """
    collection = get_events_collection()
    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {"$set": {"state": state}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def atomic_transition(
    event_id,
    from_state: EventState,
    to_state: EventState,
) -> Optional[dict]:
    """
    Atomically transition an event from *from_state* → *to_state*.

    The update filter includes the expected current state so that:
    - If the event is already in a different state, returns None (no double-transition).
    - Safe to call from concurrent workers.

    Returns the updated event doc or None if the transition was not applied.
    """
    collection = get_events_collection()
    id_q = _id_query(event_id)
    filter_q = {**id_q, "state": from_state}
    updated = await collection.find_one_and_update(
        filter_q,
        {"$set": {"state": to_state}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def approve_event(event_id, payment_amount: float) -> Optional[dict]:
    """
    Approve event request → WAITING_FOR_PAYMENT.
    Auto-calculates payment if not provided.
    """
    collection = get_events_collection()
    event = await collection.find_one(_id_query(event_id))
    if not event:
        return None

    # Fixed RIB for the platform (per request)
    rib_code = "007 999 000123456789 01"

    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {
            "$set": {
                "state": EventState.WAITING_FOR_PAYMENT,
                "payment_amount": payment_amount,
                "rib_code": rib_code,
            }
        },
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def submit_payment_proof(event_id, proof_url: str) -> Optional[dict]:
    """
    Organizer submits payment proof -> PAYMENT_PROOF_SUBMITTED.
    """
    collection = get_events_collection()
    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {
            "$set": {
                "state": EventState.PAYMENT_PROOF_SUBMITTED,
                "payment_proof_url": proof_url,
            }
        },
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def reject_event(event_id, reason: Optional[str] = None) -> Optional[dict]:
    """
    Reject event request → REJECTED.
    """
    collection = get_events_collection()
    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {"$set": {"state": EventState.REJECTED, "rejection_reason": reason}},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def confirm_event_payment(event_id) -> Optional[dict]:
    """
    Mark payment as done → PAYMENT_DONE.
    Generates unique enterprise and visitor access links.
    """
    collection = get_events_collection()
    enterprise_token = secrets.token_urlsafe(24)
    visitor_token = secrets.token_urlsafe(24)

    # Resolve the event's slug for use in public-facing links
    existing = await collection.find_one(_id_query(event_id))
    public_ref = existing.get("slug") or str(event_id) if existing else str(event_id)

    updated = await collection.find_one_and_update(
        _id_query(event_id),
        {
            "$set": {
                "state": EventState.PAYMENT_DONE,
                "enterprise_link": f"/join/enterprise/{public_ref}?token={enterprise_token}",
                "visitor_link": f"/join/visitor/{public_ref}?token={visitor_token}",
                "publicity_link": f"/events/{public_ref}",
                "enterprise_invite_token": enterprise_token,
                "visitor_invite_token": visitor_token,
            }
        },
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def get_joined_events(user_id) -> list[dict]:
    """
    Get events where the user is an APPROVED participant.
    """
    db = get_database()
    participants_collection = db["participants"]
    events_collection = db["events"]
    
    # Find accepted participations for this user
    participations = await participants_collection.find({
        "user_id": str(user_id),
        "status": {"$in": ["approved", "guest_approved"]}
    }).to_list(length=100)
    
    # event_id stored are now stringified _id values
    event_ids = []
    for p in participations:
        eid = p["event_id"]
        if ObjectId.is_valid(eid):
            event_ids.append(ObjectId(eid))
        else:
            event_ids.append(eid)
    
    if not event_ids:
        return []
        
    cursor = events_collection.find({"_id": {"$in": event_ids}})
    events = await cursor.to_list(length=100)
    return stringify_object_ids(events)
