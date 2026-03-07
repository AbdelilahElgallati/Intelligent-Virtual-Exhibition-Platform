"""
Seed demo data for the Visitor journey.

Run with:
    python -m scripts.seed_data_2

This seeds:
- Admin, Organizer, Visitor users
- One live event with stands, resources, and an approved visitor participation
- A secondary approved event for filtering/search testing

The script is idempotent: it upserts by unique fields (email, event title, stand name per event, resource title per stand).
"""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.security import hash_password
from app.db.mongo import connect_to_mongo, close_mongo_connection, get_database
from app.modules.auth.enums import Role
from app.modules.events.schemas import EventCreate, EventState
from app.modules.events.service import create_event, get_events_collection, update_event_state
from app.modules.participants.schemas import ParticipantStatus
from app.modules.participants.service import (
    approve_participant,
    get_participants_collection,
    request_to_join,
)
from app.modules.resources.repository import resource_repo
from app.modules.resources.schemas import ResourceCreate
from app.modules.stands.service import create_stand, get_stands_collection
from app.modules.users.service import create_user, get_user_by_email


def _normalize_id(doc: dict) -> dict:
    """Ensure doc has both 'id' and '_id' keys as strings so either access pattern works."""
    if doc is None:
        return doc
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "id" not in doc and "_id" in doc:
        doc["id"] = doc["_id"]
    if "_id" not in doc and "id" in doc:
        doc["_id"] = str(doc["id"])
    return doc


async def ensure_user(email: str, password: str, role: Role, full_name: str, username: str) -> dict:
    existing = await get_user_by_email(email)
    if existing:
        return _normalize_id(existing)

    user_id = uuid4()
    user = {
        "id": str(user_id),
        "email": email,
        "username": username,
        "full_name": full_name,
        "hashed_password": hash_password(password),
        "role": role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await create_user(user)
    return _normalize_id(user)


async def ensure_event(
    title: str,
    description: str,
    organizer_id: str,
    target_state: EventState,
    num_enterprises: int = 10,
    category: str = "Technology",
    tags: list[str] | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> dict:
    NOW = datetime.now(timezone.utc)
    events_col = get_events_collection()
    existing = await events_col.find_one({"title": title})
    if existing:
        existing = _normalize_id(existing)
        # Optionally bump state to target_state if lower
        if existing.get("state") != target_state:
            await update_event_state(existing["id"], target_state)
            existing["state"] = target_state
        return existing

    data = EventCreate(
        title=title,
        description=description,
        category=category,
        tags=tags or [],
        start_date=start_date or NOW,
        end_date=end_date or (NOW + timedelta(days=3)),
        num_enterprises=num_enterprises,
        event_timeline=(
            "Day 1: Opening ceremony and keynotes. "
            "Day 2: Workshop sessions and live demos. "
            "Day 3: Networking and closing ceremony."
        ),
        extended_details=(
            f"Comprehensive {category.lower()} event featuring demo exhibitors, "
            "interactive workshops, and dedicated networking sessions for all attendees."
        ),
    )
    event = await create_event(data, organizer_id)
    event = _normalize_id(event)
    # Move through approval to target_state
    if target_state != EventState.PENDING_APPROVAL:
        await update_event_state(event["id"], target_state)
        event["state"] = target_state
    return event


async def ensure_stand(
    event_id: str,
    name: str,
    organization_id: str,
    description: str,
    tags: list[str],
    category: str | None = None,
    # 2D visual customization
    theme_color: str | None = None,
    stand_background_url: str | None = None,
    presenter_name: str | None = None,
    presenter_avatar_url: str | None = None,
    presenter_avatar_bg: str | None = None,
    logo_url: str | None = None,
    stand_type: str | None = None,
) -> dict:
    stands_col = get_stands_collection()
    existing = await stands_col.find_one({"event_id": str(event_id), "name": name})

    visual_fields = {k: v for k, v in {
        "theme_color": theme_color,
        "stand_background_url": stand_background_url,
        "presenter_name": presenter_name,
        "presenter_avatar_url": presenter_avatar_url,
        "presenter_avatar_bg": presenter_avatar_bg,
        "logo_url": logo_url,
        "stand_type": stand_type,
    }.items() if v is not None}

    if existing:
        doc = _normalize_id(existing)
        if visual_fields:
            from bson import ObjectId as _OID
            _id = doc["_id"]
            flt = {"_id": _OID(_id)} if _OID.is_valid(_id) else {"_id": _id}
            await stands_col.update_one(flt, {"$set": visual_fields})
            doc.update(visual_fields)
        return doc

    stand = await create_stand(
        event_id, organization_id, name,
        description=description,
        tags=tags,
        category=category,
        **visual_fields,
    )
    return _normalize_id(stand)


async def ensure_resource(stand_id: str, title: str, file_path: str, mime_type: str, rtype: str) -> dict:
    col = resource_repo.collection
    existing = await col.find_one({"stand_id": stand_id, "title": title})
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing
    payload = ResourceCreate(
        title=title,
        description="Sample resource for demo purposes",
        stand_id=stand_id,
        type=rtype,
        tags=["demo", "visitor"],
        file_path=file_path,
        file_size=1024,
        mime_type=mime_type,
    )
    return await resource_repo.create_resource(payload)


async def ensure_participation(event_id: str, user_id: str) -> dict:
    participants_col = get_participants_collection()
    existing = await participants_col.find_one({"event_id": str(event_id), "user_id": str(user_id)})
    if existing:
        # upgrade to approved if needed
        if existing.get("status") != ParticipantStatus.APPROVED:
            await approve_participant(existing["id"])
            existing["status"] = ParticipantStatus.APPROVED
        return existing
    participant = await request_to_join(event_id, user_id)
    return await approve_participant(participant["id"])


async def ensure_notification(user_id: str, message: str, ntype: str = "general") -> dict:
    db = get_database()
    col = db["notifications"]
    existing = await col.find_one({"user_id": user_id, "message": message})
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing
    doc = {
        "user_id": user_id,
        "type": ntype,
        "message": message,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def ensure_favorite(user_id: str, target_type: str, target_id: str) -> dict:
    db = get_database()
    col = db["favorites"]
    existing = await col.find_one({"user_id": user_id, "target_type": target_type, "target_id": target_id})
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing
    doc = {
        "user_id": user_id,
        "target_type": target_type,  # e.g., "event" or "stand"
        "target_id": target_id,
        "created_at": datetime.now(timezone.utc),
    }
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def main():
    await connect_to_mongo()

    # Users
    admin = await ensure_user("admin@demo.com", "Password123!", Role.ADMIN, "Admin User", "admindemo")
    organizer = await ensure_user("organizer@demo.com", "Password123!", Role.ORGANIZER, "Organizer One", "orgdemo")
    visitor = await ensure_user("visitor@demo.com", "Password123!", Role.VISITOR, "Visitor User", "visdemo")

    # Events
    live_event = await ensure_event(
        title="Future Tech Expo",
        description="Experience AI, cloud, and XR demos across virtual stands.",
        organizer_id=organizer["_id"],
        target_state=EventState.LIVE,
    )

    approved_event = await ensure_event(
        title="Healthcare Innovations Summit",
        description="Talks and booths focused on digital health and biotech.",
        organizer_id=organizer["_id"],
        target_state=EventState.APPROVED,
    )

    # Stands for live event
    org_a = str(uuid4())
    org_b = str(uuid4())

    stand_ai = await ensure_stand(
        event_id=live_event["_id"],
        name="AI Innovations",
        organization_id=org_a,
        description="Showcasing applied AI products for enterprises.",
        tags=["AI", "ML", "Enterprise"],
        category="Technology",
        theme_color="#4f46e5",
        stand_background_url="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200",
        presenter_name="Dr. Amir Lee",
        presenter_avatar_url="https://randomuser.me/api/portraits/men/32.jpg",
        presenter_avatar_bg="#eef2ff",
        logo_url="https://ui-avatars.com/api/?name=AI+Innovations&background=4f46e5&color=fff&size=256",
        stand_type="premium",
    )

    stand_cloud = await ensure_stand(
        event_id=live_event["_id"],
        name="Cloud Native Hub",
        organization_id=org_b,
        description="Kubernetes, observability, and platform engineering demos.",
        tags=["Cloud", "DevOps", "Kubernetes"],
        category="Engineering",
        theme_color="#0891b2",
        stand_background_url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200",
        presenter_name="Maya Chen",
        presenter_avatar_url="https://randomuser.me/api/portraits/women/68.jpg",
        presenter_avatar_bg="#ecfeff",
        logo_url="https://ui-avatars.com/api/?name=Cloud+Hub&background=0891b2&color=fff&size=256",
        stand_type="standard",
    )

    # Demo stand with full visual customization
    org_demo = str(uuid4())
    stand_demo = await ensure_stand(
        event_id=live_event["_id"],
        name="Hello Jobs Virtual Booth",
        organization_id=org_demo,
        description="Welcome to Hello Jobs. Explore opportunities and connect with recruiters.",
        tags=["Recruitment", "Careers", "HR Tech"],
        category="Recruitment",
        theme_color="#f97316",
        stand_background_url="https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=1200",
        presenter_name="Sarah Johnson",
        presenter_avatar_url="https://randomuser.me/api/portraits/women/44.jpg",
        presenter_avatar_bg="#ffffff",
        logo_url="https://ui-avatars.com/api/?name=Hello+Jobs&background=f97316&color=fff&size=256",
        stand_type="sponsor",
    )

    # Resources for stands
    await ensure_resource(stand_ai["_id"], "AI Playbook.pdf", "/uploads/resources/ai-playbook.pdf", "application/pdf", "pdf")
    await ensure_resource(stand_ai["_id"], "Product Demo.mp4", "/uploads/resources/ai-demo.mp4", "video/mp4", "video")
    await ensure_resource(stand_cloud["_id"], "Cloud Native Guide.pdf", "/uploads/resources/cloud-guide.pdf", "application/pdf", "pdf")

    # Visitor participation approved for the live event
    await ensure_participation(live_event["id"], visitor["id"])

    # Favorites and notifications for visitor
    await ensure_favorite(visitor["_id"], "event", live_event["id"])
    await ensure_favorite(visitor["_id"], "stand", stand_ai["id"])
    await ensure_notification(visitor["id"], f"You're in! {live_event['title']} is live now.", "event")
    await ensure_notification(visitor["id"], "New resource added to AI Innovations stand.", "stand")

    # Optional: add simple notifications or analytics later if needed

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())