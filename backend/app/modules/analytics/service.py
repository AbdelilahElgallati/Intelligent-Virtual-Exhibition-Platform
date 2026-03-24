"""Analytics service for IVEP.

Provides compatibility-safe event logging and reporting utilities.
"""

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from bson import ObjectId

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids, _oid_or_value
from app.modules.analytics.repository import analytics_repo
from app.modules.analytics.schemas import AnalyticsEventType


# Kept for backward compatibility with modules that still import this store.
ANALYTICS_STORE: list[dict] = []


def _as_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)





def log_event(
    type: AnalyticsEventType,
    user_id: Optional[str] = None,
    event_id: Optional[str] = None,
    stand_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict:
    """Compatibility logger that appends events to memory."""
    now = datetime.now(timezone.utc)
    event = {
        "_id": str(uuid4()),
        "type": type.value if isinstance(type, AnalyticsEventType) else str(type),
        "user_id": _as_str(user_id),
        "event_id": _as_str(event_id),
        "stand_id": _as_str(stand_id),
        "metadata": metadata or {},
        "created_at": now,
        "timestamp": now,
    }
    ANALYTICS_STORE.append(event)
    return event


async def log_event_persistent(
    type: AnalyticsEventType,
    user_id: Optional[str] = None,
    event_id: Optional[str] = None,
    stand_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict:
    """Log an analytics event in MongoDB and keep in-memory mirror."""
    event = log_event(
        type=type,
        user_id=user_id,
        event_id=event_id,
        stand_id=stand_id,
        metadata=metadata,
    )
    db = get_database()
    payload = {
        "type": event["type"],
        "user_id": event.get("user_id"),
        "event_id": event.get("event_id"),
        "stand_id": event.get("stand_id"),
        "metadata": event.get("metadata") or {},
        "created_at": event["created_at"],
        "timestamp": event["timestamp"],
    }
    result = await db["analytics_events"].insert_one(payload)
    event["_id"] = str(result.inserted_id)
    return event


def list_events(limit: int = 100) -> list[dict]:
    """List in-memory events, most recent first."""
    return sorted(ANALYTICS_STORE, key=lambda x: x["created_at"], reverse=True)[:limit]


async def list_events_persistent(limit: int = 100, event_id: Optional[str] = None) -> list[dict]:
    """List persisted analytics events from MongoDB."""
    db = get_database()
    query: dict[str, Any] = {}
    if event_id:
        query["event_id"] = str(event_id)

    cursor = db["analytics_events"].find(query).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    events: list[dict] = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        events.append(doc)
    return events


async def build_admin_platform_report() -> dict:
    """Build platform-wide admin report with financial and safety metrics."""
    db = get_database()
    metrics = await analytics_repo.get_platform_metrics()

    paid_cursor = db["event_payments"].aggregate(
        [
            {"$match": {"status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
    )
    paid_rows = await paid_cursor.to_list(length=1)
    ticket_revenue = float(paid_rows[0]["total"]) if paid_rows else 0.0
    payment_count = int(paid_rows[0]["count"]) if paid_rows else 0

    total_flags = await db["content_flags"].count_documents({})
    resolved_flags = await db["content_flags"].count_documents(
        {"$or": [{"status": "resolved"}, {"resolved": True}]}
    )
    resolution_rate = round((resolved_flags / total_flags) * 100, 2) if total_flags else 0.0

    return {
        "scope": "admin_platform",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kpis": metrics.get("kpis", []),
        "main_chart": metrics.get("main_chart", []),
        "distribution": metrics.get("distribution", {}),
        "recent_activity": metrics.get("recent_activity", []),
        "revenue": {
            "ticket_revenue": round(ticket_revenue, 2),
            "stand_revenue": 0.0,
            "total_revenue": round(ticket_revenue, 2),
            "paid_transactions": payment_count,
        },
        "safety": {
            "total_flags": total_flags,
            "resolved_flags": resolved_flags,
            "resolution_rate": resolution_rate,
        },
    }


async def build_organizer_event_report(event_id: str, organizer_user_id: Optional[str] = None) -> dict:
    """Build event-scoped report used by organizer/admin consumers."""
    db = get_database()
    dashboard = await analytics_repo.get_event_analytics(event_id)
    event = await db["events"].find_one({"_id": _oid_or_value(event_id)})
    if organizer_user_id and event and str(event.get("organizer_id")) != str(organizer_user_id):
        raise PermissionError("You are not allowed to access reports for this event")

    paid_cursor = db["event_payments"].aggregate(
        [
            {"$match": {"event_id": str(event_id), "status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
    )
    paid_rows = await paid_cursor.to_list(length=1)
    ticket_revenue = float(paid_rows[0]["total"]) if paid_rows else 0.0
    paid_count = int(paid_rows[0]["count"]) if paid_rows else 0

    total_flags = await db["content_flags"].count_documents({"event_id": str(event_id)})
    resolved_flags = await db["content_flags"].count_documents(
        {"event_id": str(event_id), "$or": [{"status": "resolved"}, {"resolved": True}]}
    )
    resolution_rate = round((resolved_flags / total_flags) * 100, 2) if total_flags else 0.0

    return {
        "scope": "organizer_event",
        "event_id": str(event_id),
        "event_title": event.get("title") if event else f"Event {event_id}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kpis": dashboard.get("kpis", []),
        "main_chart": dashboard.get("main_chart", []),
        "distribution": dashboard.get("distribution", {}),
        "recent_activity": dashboard.get("recent_activity", []),
        "enterprises": dashboard.get("enterprises", []),
        "revenue": {
            "ticket_revenue": round(ticket_revenue, 2),
            "stand_revenue": 0.0,
            "total_revenue": round(ticket_revenue, 2),
            "paid_transactions": paid_count,
        },
        "safety": {
            "total_flags": total_flags,
            "resolved_flags": resolved_flags,
            "resolution_rate": resolution_rate,
        },
    }


async def build_organizer_overall_report(organizer_user_id: str) -> dict:
    """Build organizer report aggregating all organizer-owned events."""
    db = get_database()
    events = await db["events"].find({"organizer_id": str(organizer_user_id)}).to_list(length=500)
    event_ids = [str(e.get("_id")) for e in events]
    if not event_ids:
        return {
            "scope": "organizer_overall",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "kpis": [],
            "main_chart": [],
            "distribution": {},
            "recent_activity": [],
            "revenue": {"ticket_revenue": 0.0, "stand_revenue": 0.0, "total_revenue": 0.0, "paid_transactions": 0},
            "safety": {"total_flags": 0, "resolved_flags": 0, "resolution_rate": 0.0},
            "event_count": 0,
        }

    paid_cursor = db["event_payments"].aggregate(
        [
            {"$match": {"event_id": {"$in": event_ids}, "status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
    )
    paid_rows = await paid_cursor.to_list(length=1)
    ticket_revenue = float(paid_rows[0]["total"]) if paid_rows else 0.0
    paid_count = int(paid_rows[0]["count"]) if paid_rows else 0

    total_flags = await db["content_flags"].count_documents({"event_id": {"$in": event_ids}})
    resolved_flags = await db["content_flags"].count_documents(
        {"event_id": {"$in": event_ids}, "$or": [{"status": "resolved"}, {"resolved": True}]}
    )
    resolution_rate = round((resolved_flags / total_flags) * 100, 2) if total_flags else 0.0

    total_participants = await db["participants"].count_documents(
        {"event_id": {"$in": event_ids}, "status": "approved"}
    )
    total_leads = 0
    total_meetings = 0
    total_chats = await db["chat_messages"].count_documents({"event_id": {"$in": event_ids}})

    stand_ids = await db["stands"].distinct("_id", {"event_id": {"$in": event_ids}})
    stand_id_strings = [str(s) for s in stand_ids]
    if stand_id_strings:
        total_leads = await db["leads"].count_documents({"stand_id": {"$in": stand_id_strings}})
        total_meetings = await db["meetings"].count_documents(
            {"stand_id": {"$in": stand_id_strings}, "status": {"$in": ["approved", "completed"]}}
        )

    return {
        "scope": "organizer_overall",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kpis": [
            {"label": "Events Managed", "value": float(len(event_ids)), "trend": None},
            {"label": "Approved Participants", "value": float(total_participants), "trend": None},
            {"label": "Leads Generated", "value": float(total_leads), "trend": None},
            {"label": "Meetings", "value": float(total_meetings), "trend": None},
            {"label": "Chat Messages", "value": float(total_chats), "trend": None},
        ],
        "main_chart": [],
        "distribution": {},
        "recent_activity": [],
        "revenue": {
            "ticket_revenue": round(ticket_revenue, 2),
            "stand_revenue": 0.0,
            "total_revenue": round(ticket_revenue, 2),
            "paid_transactions": paid_count,
        },
        "safety": {
            "total_flags": total_flags,
            "resolved_flags": resolved_flags,
            "resolution_rate": resolution_rate,
        },
        "event_count": len(event_ids),
    }


async def build_enterprise_event_report(event_id: str, enterprise_user_id: str) -> dict:
    """Build enterprise-focused report for a member inside a specific event."""
    db = get_database()
    member_doc = await db["organization_members"].find_one({"user_id": str(enterprise_user_id)})
    if not member_doc or not member_doc.get("organization_id"):
        return {
            "scope": "enterprise_event",
            "event_id": str(event_id),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "kpis": [],
            "distribution": {},
            "recent_activity": [],
            "revenue": {"ticket_revenue": 0.0, "stand_revenue": 0.0, "total_revenue": 0.0},
            "safety": {"total_flags": 0, "resolved_flags": 0, "resolution_rate": 0.0},
            "note": "No organization membership found for this enterprise user.",
        }

    org_id = str(member_doc["organization_id"])
    stand = await db["stands"].find_one({"event_id": str(event_id), "organization_id": org_id})
    stand_id = str(stand.get("_id")) if stand else None

    leads = await db["leads"].count_documents({"stand_id": stand_id}) if stand_id else 0
    meetings = await db["meetings"].count_documents(
        {
            "event_id": str(event_id),
            "stand_id": stand_id,
            "status": {"$in": ["approved", "completed"]},
        }
    ) if stand_id else 0
    visits = await db["analytics_events"].count_documents(
        {"event_id": str(event_id), "stand_id": stand_id, "type": "stand_visit"}
    ) if stand_id else 0

    room_ids = await db["chat_rooms"].distinct(
        "_id",
        {"event_id": str(event_id), "members": str(enterprise_user_id)},
    )
    chat_messages = await db["chat_messages"].count_documents({"room_id": {"$in": [str(r) for r in room_ids]}}) if room_ids else 0

    return {
        "scope": "enterprise_event",
        "event_id": str(event_id),
        "organization_id": org_id,
        "stand_id": stand_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kpis": [
            {"label": "Stand Visits", "value": float(visits), "trend": None},
            {"label": "Leads", "value": float(leads), "trend": None},
            {"label": "Meetings", "value": float(meetings), "trend": None},
            {"label": "Chat Messages", "value": float(chat_messages), "trend": None},
        ],
        "distribution": {
            "visits": float(visits),
            "leads": float(leads),
            "meetings": float(meetings),
            "chat_messages": float(chat_messages),
        },
        "recent_activity": [],
        "revenue": {"ticket_revenue": 0.0, "stand_revenue": 0.0, "total_revenue": 0.0},
        "safety": {"total_flags": 0, "resolved_flags": 0, "resolution_rate": 0.0},
    }


async def validate_event_report_consistency(event_id: str) -> dict:
    """Run lightweight consistency checks across analytics, participants, and payments."""
    db = get_database()
    issues: list[dict[str, Any]] = []

    total_participants = await db["participants"].count_documents({"event_id": str(event_id)})
    approved_participants = await db["participants"].count_documents(
        {"event_id": str(event_id), "status": "approved"}
    )
    if approved_participants > total_participants:
        issues.append(
            {
                "code": "participants_approved_overflow",
                "severity": "high",
                "message": "Approved participants exceed total participant records.",
            }
        )

    paid_without_timestamp = await db["event_payments"].count_documents(
        {"event_id": str(event_id), "status": "paid", "$or": [{"paid_at": None}, {"paid_at": {"$exists": False}}]}
    )
    if paid_without_timestamp:
        issues.append(
            {
                "code": "payment_missing_paid_at",
                "severity": "medium",
                "message": f"{paid_without_timestamp} paid payments are missing paid_at timestamps.",
            }
        )

    completed_without_approval = await db["meetings"].count_documents(
        {"event_id": str(event_id), "status": "completed", "session_status": {"$ne": "ended"}}
    )
    if completed_without_approval:
        issues.append(
            {
                "code": "meetings_completed_without_ended_session",
                "severity": "low",
                "message": f"{completed_without_approval} completed meetings are not marked with ended session_status.",
            }
        )

    health_score = max(0, 100 - len(issues) * 20)
    return {
        "event_id": str(event_id),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "health_score": health_score,
        "issue_count": len(issues),
        "issues": issues,
    }
