"""
Monitoring service — aggregates live operational metrics for a given event.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from bson import ObjectId

from app.db.mongo import get_database
from app.modules.monitoring.presence import get_active_users, get_active_count
from app.modules.monitoring.schemas import (
    ActiveUserRead,
    KPIs,
    LiveMetricsResponse,
    RecentFlagRead,
)


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _str_id(doc: dict) -> str:
    return str(doc.get("_id", ""))


# ─── Aggregation functions ────────────────────────────────────────────────────

async def _count_active_stands(db, event_id: str, active_user_ids: set) -> int:
    """
    Count stands for the event where there was recent chat activity (last 15 min).
    Falls back to checking presence-based room membership.
    """
    cutoff = _now() - timedelta(minutes=15)

    # Get all stands for this event
    stand_ids = [
        str(s["_id"])
        async for s in db.stands.find({"event_id": event_id}, {"_id": 1})
    ]
    if not stand_ids:
        return 0

    # Count stands with recent chat messages via rooms
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {
            "$lookup": {
                "from": "chat_rooms",
                "localField": "room_id",
                "foreignField": "_id",
                "as": "room",
            }
        },
        {"$unwind": {"path": "$room", "preserveNullAndEmptyArrays": True}},
        {"$match": {"room.stand_id": {"$in": stand_ids}}},
        {"$group": {"_id": "$room.stand_id"}},
        {"$count": "active_count"},
    ]
    result = await db.chat_messages.aggregate(pipeline).to_list(length=1)
    pipeline_count = result[0]["active_count"] if result else 0

    # Also count stands with active presence members
    presence_count = 0
    if active_user_ids:
        async for _room in db.chat_rooms.find(
            {
                "stand_id": {"$in": stand_ids},
                "members": {"$in": list(active_user_ids)},
            },
            {"stand_id": 1},
        ):
            presence_count += 1

    return max(pipeline_count, presence_count)


async def _count_ongoing_meetings(db, event_id: str) -> int:
    """
    Count meetings where:
    - stand belongs to the event
    - start_time <= now <= end_time
    - status == approved
    """
    now = _now()

    stand_ids = [
        str(s["_id"])
        async for s in db.stands.find({"event_id": event_id}, {"_id": 1})
    ]
    if not stand_ids:
        return 0

    count = await db.meetings.count_documents(
        {
            "stand_id": {"$in": stand_ids},
            "start_time": {"$lte": now},
            "end_time": {"$gte": now},
            "status": "approved",
        }
    )
    return count


async def _count_messages_per_minute(db, event_id: str) -> int:
    """
    Count chat_messages for this event in the last 1 minute.
    Tries direct event_id field first; falls back to room join.
    """
    cutoff = _now() - timedelta(minutes=1)

    # Try direct event_id match
    count = await db.chat_messages.count_documents(
        {"event_id": event_id, "timestamp": {"$gte": cutoff}}
    )
    if count:
        return count

    # Fallback via chat_rooms linked to event stands
    stand_ids = [
        str(s["_id"])
        async for s in db.stands.find({"event_id": event_id}, {"_id": 1})
    ]

    # Build room query — handle empty stand list cleanly
    room_query: dict = {"event_id": event_id}
    if stand_ids:
        room_query = {"$or": [{"event_id": event_id}, {"stand_id": {"$in": stand_ids}}]}

    room_ids = [
        r["_id"]
        async for r in db.chat_rooms.find(room_query, {"_id": 1})
    ]
    if not room_ids:
        return 0

    room_id_strs = [str(r) for r in room_ids]
    count = await db.chat_messages.count_documents(
        {"room_id": {"$in": room_id_strs}, "timestamp": {"$gte": cutoff}}
    )
    return count


async def _count_downloads_last_hour(db, event_id: str) -> int:
    """Count resource_download analytics events in the last hour for this event."""
    cutoff = _now() - timedelta(hours=1)
    count = await db.analytics_events.count_documents(
        {
            "event_id": event_id,
            "type": "resource_download",
            "timestamp": {"$gte": cutoff},
        }
    )
    return count


async def _get_open_flags(db, event_id: str, limit: int = 5) -> tuple[int, list]:
    """
    Return (count, [flags]) for unresolved content_flags related to this event.
    """
    stand_ids = [
        str(s["_id"])
        async for s in db.stands.find({"event_id": event_id}, {"_id": 1})
    ]

    entity_ids = [event_id] + stand_ids

    base_query = {
        "entity_id": {"$in": entity_ids},
        "resolved": {"$ne": True},
    }

    total = await db.content_flags.count_documents(base_query)

    flags = []
    async for doc in (
        db.content_flags.find(base_query)
        .sort("created_at", -1)
        .limit(limit)
    ):
        flags.append(
            RecentFlagRead(
                id=str(doc["_id"]),
                entity_type=doc.get("entity_type", ""),
                entity_id=doc.get("entity_id", ""),
                reason=doc.get("reason", ""),
                created_at=doc.get("created_at", _now()),
            )
        )

    return total, flags


# ─── Main aggregation ─────────────────────────────────────────────────────────

async def get_live_metrics(event_id: str) -> LiveMetricsResponse:
    """
    Aggregate and return live operational metrics for the given event.
    Runs all DB queries in parallel using asyncio.gather.
    """
    import asyncio

    db = get_database()

    # Presence data (in-memory, O(1))
    active_users_raw = get_active_users(event_id)
    active_count = get_active_count(event_id)
    active_user_ids = {u["user_id"] for u in active_users_raw}

    # Run the 5 independent DB queries in parallel
    results = await asyncio.gather(
        _count_active_stands(db, event_id, active_user_ids),
        _count_ongoing_meetings(db, event_id),
        _count_messages_per_minute(db, event_id),
        _count_downloads_last_hour(db, event_id),
        _get_open_flags(db, event_id),
        return_exceptions=True,
    )

    # Safely unpack — default to 0 / empty on error
    def _safe_int(v) -> int:
        return v if isinstance(v, int) else 0

    active_stands   = _safe_int(results[0])
    ongoing_meetings = _safe_int(results[1])
    messages_per_min = _safe_int(results[2])
    downloads_hour  = _safe_int(results[3])
    flags_result    = results[4]

    if isinstance(flags_result, tuple):
        flags_open_count, recent_flags = flags_result
    else:
        flags_open_count, recent_flags = 0, []

    return LiveMetricsResponse(
        kpis=KPIs(
            active_visitors=active_count,
            active_stands=active_stands,
            ongoing_meetings=ongoing_meetings,
            messages_per_minute=messages_per_min,
            resource_downloads_last_hour=downloads_hour,
            incident_flags_open=flags_open_count,
        ),
        active_users=[ActiveUserRead(**u) for u in active_users_raw],
        recent_flags=recent_flags,
        timestamp=_now().isoformat(),
    )

