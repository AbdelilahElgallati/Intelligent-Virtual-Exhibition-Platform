from motor.motor_asyncio import AsyncIOMotorDatabase
from .mongo import get_database


async def ensure_indexes() -> None:
    db: AsyncIOMotorDatabase = get_database()
    if db is None:
        return

    # Users (fallback store)
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("role")
        await db.users.create_index("is_active")
    except Exception:
        pass

    # Organizations
    try:
        await db.organizations.create_index("owner_id")
        await db.organizations.create_index("created_at")
    except Exception:
        pass

    # Events
    try:
        await db.events.create_index("organizer_id")
        await db.events.create_index("state")
        await db.events.create_index("created_at")
        await db.events.create_index([("title", "text")])
    except Exception:
        pass

    # Participants
    try:
        await db.participants.create_index([("event_id", 1), ("user_id", 1)], unique=True)
        await db.participants.create_index("status")
    except Exception:
        pass

    # Stands
    try:
        await db.stands.create_index([("event_id", 1), ("organization_id", 1)], unique=True)
        await db.stands.create_index("name")
    except Exception:
        pass

    # Resources
    try:
        await db.resources.create_index("stand_id")
        await db.resources.create_index("upload_date")
        await db.resources.create_index("downloads")
        await db.resources.create_index([("title", "text"), ("tags", "text")])
    except Exception:
        pass

    # Meetings
    try:
        await db.meetings.create_index("stand_id")
        await db.meetings.create_index("visitor_id")
        await db.meetings.create_index("status")
        await db.meetings.create_index("start_time")
    except Exception:
        pass

    # Leads
    try:
        await db.leads.create_index([("visitor_id", 1), ("stand_id", 1)], unique=True)
        await db.leads.create_index("score")
        await db.leads.create_index("last_interaction")
    except Exception:
        pass

    # Lead Interactions
    try:
        await db.lead_interactions.create_index("stand_id")
        await db.lead_interactions.create_index("visitor_id")
        await db.lead_interactions.create_index("timestamp")
    except Exception:
        pass

    # Chat Rooms / Messages
    try:
        await db.chat_rooms.create_index("members")
        await db.chat_rooms.create_index("created_at")
        await db.chat_messages.create_index("room_id")
        await db.chat_messages.create_index("timestamp")
    except Exception:
        pass

    # Notifications
    try:
        await db.notifications.create_index("user_id")
        await db.notifications.create_index("created_at")
        await db.notifications.create_index("type")
    except Exception:
        pass

    # Subscriptions
    try:
        await db.subscriptions.create_index("organization_id", unique=True)
        await db.subscriptions.create_index("plan")
    except Exception:
        pass

    # Assistant (RAG)
    try:
        await db.assistant_sessions.create_index("scope")
        await db.assistant_sessions.create_index("user_id")
        await db.assistant_messages.create_index("session_id")
        await db.assistant_messages.create_index("timestamp")
    except Exception:
        pass

    # Analytics events (optional)
    try:
        await db.analytics_events.create_index("event_id")
        await db.analytics_events.create_index("stand_id")
        await db.analytics_events.create_index("user_id")
        await db.analytics_events.create_index("type")
        await db.analytics_events.create_index("timestamp")
    except Exception:
        pass
