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
    StandActivity,
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
            "$addFields": {
                "room_id_obj": {
                    "$cond": [
                        {"$regexMatch": {"input": "$room_id", "regex": "^[0-9a-fA-F]{24}$"}},
                        {"$toObjectId": "$room_id"},
                        "$room_id"
                    ]
                }
            }
        },
        {
            "$lookup": {
                "from": "chat_rooms",
                "localField": "room_id_obj",
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


async def _get_top_active_stands(db, event_id: str, active_user_ids: set, limit: int = 5) -> list[StandActivity]:
    """
    Return the top active stands for the event, ranked by:
    1. Active users currently in the stand's chat room.
    2. Recent message count.
    """
    # Get all stands for this event
    all_stands = []
    async for s in db.stands.find({"event_id": event_id}, {"_id": 1, "title": 1, "name": 1}):
        all_stands.append(s)

    if not all_stands:
        return []

    stand_ids = [str(s["_id"]) for s in all_stands]
    stand_names = {str(s["_id"]): s.get("title") or s.get("name", "Unnamed Stand") for s in all_stands}

    # 1. Count current presence
    stand_presence: dict[str, int] = {}
    if active_user_ids:
        async for room in db.chat_rooms.find(
            {
                "stand_id": {"$in": stand_ids},
                "members": {"$in": list(active_user_ids)},
            },
            {"stand_id": 1, "members": 1},
        ):
            sid = room["stand_id"]
            members = set(room.get("members", []))
            active_mems = members.intersection(active_user_ids)
            stand_presence[sid] = stand_presence.get(sid, 0) + len(active_mems)

    # 2. Add recent message weight (last 30 min)
    cutoff = _now() - timedelta(minutes=30)
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {
            "$addFields": {
                "room_id_obj": {
                    "$cond": [
                        {"$regexMatch": {"input": "$room_id", "regex": "^[0-9a-fA-F]{24}$"}},
                        {"$toObjectId": "$room_id"},
                        "$room_id"
                    ]
                }
            }
        },
        {
            "$lookup": {
                "from": "chat_rooms",
                "localField": "room_id_obj",
                "foreignField": "_id",
                "as": "room",
            }
        },
        {"$unwind": "$room"},
        {"$match": {"room.stand_id": {"$in": stand_ids}}},
        {"$group": {"_id": "$room.stand_id", "msg_count": {"$sum": 1}}},
    ]

    async for res in db.chat_messages.aggregate(pipeline):
        sid = res["_id"]
        # Weight presence higher than messages for "Live" feel
        stand_presence[sid] = stand_presence.get(sid, 0) + (res["msg_count"] * 0.5)

    # Sort and return top N
    sorted_stands = sorted(stand_presence.items(), key=lambda x: x[1], reverse=True)[:limit]

    return [
        StandActivity(
            id=sid,
            name=stand_names.get(sid, "Unknown"),
            active_count=int(score),  # Rounding score to int for UI
        )
        for sid, score in sorted_stands if score > 0
    ]


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

    # Run the independent DB queries in parallel
    results = await asyncio.gather(
        _count_active_stands(db, event_id, active_user_ids),
        _count_ongoing_meetings(db, event_id),
        _count_messages_per_minute(db, event_id),
        _count_downloads_last_hour(db, event_id),
        _get_open_flags(db, event_id),
        _get_top_active_stands(db, event_id, active_user_ids),
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
    top_stands      = results[5] if isinstance(results[5], list) else []

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
        top_active_stands=top_stands,
        timestamp=_now().isoformat(),
    )

