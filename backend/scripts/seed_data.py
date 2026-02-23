"""
Seed demo data for the Visitor journey.

Run with:
    python -m scripts.seed_data

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


async def ensure_user(email: str, password: str, role: Role, full_name: str, username: str) -> dict:
    existing = await get_user_by_email(email)
    if existing:
        return existing

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
    return user


async def ensure_event(title: str, description: str, organizer_id: str, target_state: EventState) -> dict:
    events_col = get_events_collection()
    existing = await events_col.find_one({"title": title})
    if existing:
        # Optionally bump state to target_state if lower
        if existing.get("state") != target_state:
            await update_event_state(existing["id"], target_state)
            existing["state"] = target_state
        return existing

    data = EventCreate(
        title=title,
        description=description,
        num_enterprises=5,
        event_timeline="Day 1: Opening ceremony and keynotes. Day 2: Workshop sessions. Day 3: Closing and networking.",
        extended_details="This is a seeded demo event with sample exhibitors and sessions.",
    )
    event = await create_event(data, organizer_id)
    # Move through states to target_state
    if target_state != EventState.PENDING_APPROVAL:
        await update_event_state(event["id"], target_state)
        event["state"] = target_state
    return event


async def ensure_stand(event_id: str, name: str, organization_id: str, description: str, tags: list[str]) -> dict:
    stands_col = get_stands_collection()
    existing = await stands_col.find_one({"event_id": str(event_id), "name": name})
    if existing:
        return existing
    stand = await create_stand(event_id, organization_id, name)
    await stands_col.update_one({"id": stand["id"]}, {"$set": {"description": description, "tags": tags}})
    stand["description"] = description
    stand["tags"] = tags
    return stand


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
        organizer_id=organizer["id"],
        target_state=EventState.LIVE,
    )

    approved_event = await ensure_event(
        title="Healthcare Innovations Summit",
        description="Talks and booths focused on digital health and biotech.",
        organizer_id=organizer["id"],
        target_state=EventState.WAITING_FOR_PAYMENT,
    )

    # Stands for live event
    org_a = str(uuid4())
    org_b = str(uuid4())

    stand_ai = await ensure_stand(
        event_id=live_event["id"],
        name="AI Innovations",
        organization_id=org_a,
        description="Showcasing applied AI products for enterprises.",
        tags=["AI", "ML", "Enterprise"],
    )

    stand_cloud = await ensure_stand(
        event_id=live_event["id"],
        name="Cloud Native Hub",
        organization_id=org_b,
        description="Kubernetes, observability, and platform engineering demos.",
        tags=["Cloud", "DevOps", "Kubernetes"],
    )

    # Resources for stands
    await ensure_resource(stand_ai["id"], "AI Playbook.pdf", "/uploads/resources/ai-playbook.pdf", "application/pdf", "pdf")
    await ensure_resource(stand_ai["id"], "Product Demo.mp4", "/uploads/resources/ai-demo.mp4", "video/mp4", "video")
    await ensure_resource(stand_cloud["id"], "Cloud Native Guide.pdf", "/uploads/resources/cloud-guide.pdf", "application/pdf", "pdf")

    # Visitor participation approved for the live event
    await ensure_participation(live_event["id"], visitor["id"])

    # Favorites and notifications for visitor
    await ensure_favorite(visitor["id"], "event", live_event["id"])
    await ensure_favorite(visitor["id"], "stand", stand_ai["id"])
    await ensure_notification(visitor["id"], f"You're in! {live_event['title']} is live now.", "event")
    await ensure_notification(visitor["id"], "New resource added to AI Innovations stand.", "stand")

    # Optional: add simple notifications or analytics later if needed

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
