"""
Organizer Report Service — Week 6.

Runs parallel MongoDB aggregations to compute:
  - Visitor & enterprise metrics
  - Stand engagement score
  - Leads & meetings
  - Chat interactions
  - Revenue summary
  - Safety / flag resolution
  - Time-series performance trends
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId

from app.db.mongo import get_database
from app.modules.analytics.service import ANALYTICS_STORE
from app.modules.organizer_report.schemas import (
    OrganizerSummaryResponse,
    OverviewMetrics,
    PerformanceTrends,
    RevenueSummary,
    SafetyMetrics,
    TrendPoint,
)

logger = logging.getLogger(__name__)


# ─── helpers ─────────────────────────────────────────────────────────────────

def _to_oid(eid: str) -> Optional[ObjectId]:
    try:
        return ObjectId(eid)
    except Exception:
        return None


def _date_label(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


# ─── individual metric queries ────────────────────────────────────────────────

# ─── individual metric queries ────────────────────────────────────────────────

async def _visitor_counts(db, event_id_ref: str | list[str]) -> tuple[int, int]:
    """
    Return (active_visitors, approved_enterprises).
    active_visitors: Distinct user_ids in analytics_events for this event.
    approved_enterprises: Role 'enterprise' with status 'approved'/'guest_approved' in participants.
    """
    ids_to_check = [event_id_ref] if isinstance(event_id_ref, str) else list(event_id_ref)
    
    # 1. Active Visitors (Distinct from Analytics)
    active_visitors = await db["analytics_events"].distinct("user_id", {"event_id": {"$in": ids_to_check}})
    visitors_count = len(active_visitors)

    # 2. Approved Enterprises (From Participants)
    match_q = {"event_id": {"$in": ids_to_check}, "role": "enterprise", "status": {"$in": ["approved", "guest_approved"]}}
    enterprises_count = await db["participants"].count_documents(match_q)
    
    return visitors_count, enterprises_count


async def _enterprise_rate(db, event_id_ref: str | list[str]) -> float:
    """approved_enterprises / total_enterprise_requests × 100"""
    match_q = {"event_id": {"$in": event_id_ref}} if isinstance(event_id_ref, list) else {"event_id": event_id_ref}
    pipeline = [
        {"$match": {**match_q, "role": "enterprise"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "approved": {"$sum": {"$cond": [{"$in": ["$status", ["approved", "guest_approved"]]}, 1, 0]}},
        }},
    ]
    rows = await db["participants"].aggregate(pipeline).to_list(length=1)
    if not rows or rows[0]["total"] == 0:
        return 0.0
    return round(rows[0]["approved"] / rows[0]["total"] * 100, 1)


async def _leads_count(db, stand_ids: list[str]) -> int:
    """Count leads whose stand_id belongs to the specified event(s)."""
    if not stand_ids:
        return 0
    count = await db["leads"].count_documents({"stand_id": {"$in": stand_ids}})
    return count


async def _meetings_count(db, stand_ids: list[str]) -> int:
    """Count approved/completed meetings for stands of the specified event(s)."""
    if not stand_ids:
        return 0
    count = await db["meetings"].count_documents({
        "stand_id": {"$in": stand_ids},
        "status": {"$in": ["approved", "completed"]},
    })
    return count


async def _chat_count(db, event_id_ref: str | list[str]) -> int:
    """Count chat messages in the specified event(s)."""
    match_q = {"event_id": {"$in": event_id_ref}} if isinstance(event_id_ref, list) else {"event_id": event_id_ref}
    count = await db["chat_messages"].count_documents(match_q)
    return count


async def _stand_ids_for_events(db, event_id_ref: str | list[str]) -> list[str]:
    match_q = {"event_id": {"$in": event_id_ref}} if isinstance(event_id_ref, list) else {"event_id": event_id_ref}
    cursor = db["stands"].find(match_q, {"_id": 1})
    docs = await cursor.to_list(length=None)
    return [str(d["_id"]) for d in docs]


async def _stand_engagement_score(
    db,
    event_id_ref: str | list[str],
    stand_ids: list[str],
    meetings: int,
) -> float:
    """
    Composite score (0–100):
      stand_visits × 0.4 + downloads × 0.2 + chat_messages × 0.2 + meetings × 0.2
    Normalised to 100 via a log-based cap so 1 000 interactions ≈ 100.
    """
    import math

    ids_to_check = set(event_id_ref) if isinstance(event_id_ref, list) else {event_id_ref}

    # Stand visits from in-memory analytics
    stand_visits = sum(
        1 for e in ANALYTICS_STORE
        if e.get("type") in ("stand_visit", "STAND_VISIT")
        and str(e.get("event_id", "")) in ids_to_check
    )

    # Also try persistent analytics_events collection
    try:
        match_q = {"event_id": {"$in": list(ids_to_check)}}
        mongo_visits = await db["analytics_events"].count_documents({
            **match_q,
            "type": {"$in": ["stand_visit", "STAND_VISIT"]},
        })
        stand_visits += mongo_visits
    except Exception:
        pass

    downloads_q = {"event_id": {"$in": list(ids_to_check)}} if isinstance(event_id_ref, list) else {"event_id": event_id_ref}
    downloads = await db["resource_downloads"].count_documents(downloads_q) if stand_ids else 0

    try:
        chat_count = await db["chat_messages"].count_documents(downloads_q)
    except Exception:
        chat_count = 0

    raw = stand_visits * 0.4 + downloads * 0.2 + chat_count * 0.2 + meetings * 0.2
    # log-normalise: score = min(100, log10(raw + 1) / log10(1001) * 100)
    score = min(100.0, math.log10(raw + 1) / math.log10(1001) * 100) if raw > 0 else 0.0
    return round(score, 1)


async def _safety_metrics(db, event_id_ref: str | list[str]) -> SafetyMetrics:
    """Count content_flags tied to the specified event(s); resolved = status resolved."""
    match_q = {"event_id": {"$in": event_id_ref}} if isinstance(event_id_ref, list) else {"event_id": event_id_ref}
    total = await db["content_flags"].count_documents(match_q)
    if total == 0 and not isinstance(event_id_ref, list):
        # fall back to global flags if no event-scoped ones (only for single event lookup)
        total = await db["content_flags"].count_documents({})
        resolved = await db["content_flags"].count_documents({"status": "resolved"})
    else:
        resolved = await db["content_flags"].count_documents({
            **match_q,
            "status": "resolved",
        })
    rate = round(resolved / total * 100, 1) if total else 0.0
    return SafetyMetrics(total_flags=total, resolved_flags=resolved, resolution_rate=rate)


async def _revenue(db, event_id_ref: str | list[str], approved_visitors: int, approved_enterprises: int) -> RevenueSummary:
    ids_to_check = [event_id_ref] if isinstance(event_id_ref, str) else list(event_id_ref)
    
    # 1. Ticket Revenue (Actual paid event_payments)
    paid_cursor = db["event_payments"].aggregate([
        {"$match": {"event_id": {"$in": ids_to_check}, "status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ])
    paid_rows = await paid_cursor.to_list(length=1)
    ticket_rev = float(paid_rows[0]["total"]) if paid_rows else 0.0

    # 2. Stand Revenue (Participants with role 'enterprise' and stand_fee_paid=True)
    # We sum the stand_price from the corresponding events
    stand_rev = 0.0
    oids = [_to_oid(eid) for eid in ids_to_check if _to_oid(eid)]
    ev_cursor = db["events"].find({"_id": {"$in": oids}}, {"stand_price": 1})
    event_prices = {str(e["_id"]): float(e.get("stand_price") or 0) async for e in ev_cursor}

    part_cursor = db["participants"].find({
        "event_id": {"$in": ids_to_check},
        "role": "enterprise",
        "$or": [{"stand_fee_paid": True}, {"payment_reference": {"$exists": True, "$ne": ""}}]
    }, {"event_id": 1})
    
    async for p in part_cursor:
        ev_id = p.get("event_id")
        stand_rev += event_prices.get(ev_id, 0.0)

    total = round(ticket_rev + stand_rev, 2)
    return RevenueSummary(ticket_revenue=round(ticket_rev, 2), stand_revenue=round(stand_rev, 2), total_revenue=total)


# ─── time-series trends ───────────────────────────────────────────────────────

async def _trend_participants(db, event_id_ref: str | list[str]) -> list[TrendPoint]:
    """Group distinct daily visitors by date from analytics events."""
    ids_to_check = [event_id_ref] if isinstance(event_id_ref, str) else list(event_id_ref)
    
    pipeline = [
        {"$match": {"event_id": {"$in": ids_to_check}}},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "user_id": "$user_id"
            }
        }},
        {"$group": {
            "_id": "$_id.date",
            "value": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db["analytics_events"].aggregate(pipeline).to_list(length=None)
    return [TrendPoint(date=r["_id"], value=r["value"]) for r in rows if r.get("_id")]


async def _trend_engagement(event_id_ref: str | list[str]) -> list[TrendPoint]:
    """Group analytics events by date from database."""
    db = get_database()
    ids_to_check = [event_id_ref] if isinstance(event_id_ref, str) else list(event_id_ref)
    
    pipeline = [
        {"$match": {"event_id": {"$in": ids_to_check}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    points = []
    async for res in db.analytics_events.aggregate(pipeline):
        points.append(TrendPoint(date=res["_id"], value=res["count"]))
        
    # Merge with in-memory store for very recent events not yet persisted if necessary,
    # but for a dashboard, DB-only is usually preferred for consistency.
    # To be safe, we'll just use DB as it's the source of truth now.
    return points


async def _trend_leads(db, stand_ids: list[str]) -> list[TrendPoint]:
    if not stand_ids:
        return []
    pipeline = [
        {"$match": {"stand_id": {"$in": stand_ids}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$last_interaction"}},
            "value": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db["leads"].aggregate(pipeline).to_list(length=None)
    return [TrendPoint(date=r["_id"], value=r["value"]) for r in rows if r.get("_id")]


# ─── Enterprise List ──────────────────────────────────────────────────────────

async def _get_participating_enterprises(db, event_id_ref: str | list[str]) -> list[EnterpriseSummary]:
    """Fetch basic info for all approved enterprises in the specified event(s)."""
    match_q = {"event_id": {"$in": event_id_ref}} if isinstance(event_id_ref, list) else {"event_id": event_id_ref}
    cursor = db["participants"].find({**match_q, "role": "enterprise", "status": {"$in": ["approved", "guest_approved"]}})
    participants = await cursor.to_list(length=None)
    
    org_ids = []
    for p in participants:
         oid = p.get("organization_id")
         if oid:
             try:
                 org_ids.append(ObjectId(str(oid)) if ObjectId.is_valid(str(oid)) else str(oid))
             except Exception:
                 org_ids.append(str(oid))

    if not org_ids:
        return []

    # Filter out valid vs invalid ObjectIds
    valid_oids = [o for o in org_ids if isinstance(o, ObjectId)]
    string_ids = [o for o in org_ids if isinstance(o, str) and not ObjectId.is_valid(o)]
    
    query = {"$or": []}
    if valid_oids:
        query["$or"].append({"_id": {"$in": valid_oids}})
    if string_ids:
        query["$or"].append({"_id": {"$in": string_ids}})
    
    if not query["$or"]:
        return []

    org_cursor = db["organizations"].find(query)
    orgs = await org_cursor.to_list(length=None)
    
    from .schemas import EnterpriseSummary
    return [
        EnterpriseSummary(
            id=str(o["_id"]),
            name=o.get("name", "Unknown"),
            logo_url=o.get("logo_url"),
            industry=o.get("org_type") or o.get("industry")
        )
        for o in orgs
    ]


# ─── main entry points ────────────────────────────────────────────────────────

async def get_organizer_summary(event_id: str) -> OrganizerSummaryResponse:
    """Aggregate all engagement metrics for the specified event."""
    db = get_database()

    # Parallel phase 1 — gather stand IDs
    stand_ids = await _stand_ids_for_events(db, event_id)

    # Parallel phase 2
    (
        (approved_visitors, approved_enterprises),
        ent_rate,
        leads,
        meetings,
        chat,
        safety,
        trend_visitors,
        trend_engagement,
        trend_leads,
        enterprises,
    ) = await asyncio.gather(
        _visitor_counts(db, event_id),
        _enterprise_rate(db, event_id),
        _leads_count(db, stand_ids),
        _meetings_count(db, stand_ids),
        _chat_count(db, event_id),
        _safety_metrics(db, event_id),
        _trend_participants(db, event_id),
        _trend_engagement(event_id),
        _trend_leads(db, stand_ids),
        _get_participating_enterprises(db, event_id),
    )

    engagement_score = await _stand_engagement_score(db, event_id, stand_ids, meetings)
    revenue = await _revenue(db, event_id, approved_visitors, approved_enterprises)

    return OrganizerSummaryResponse(
        overview=OverviewMetrics(
            total_visitors=approved_visitors,
            enterprise_participation_rate=ent_rate,
            stand_engagement_score=engagement_score,
            leads_generated=leads,
            meetings_booked=meetings,
            chat_interactions=chat,
            revenue_summary=revenue,
        ),
        safety=safety,
        performance_trends=PerformanceTrends(
            visitors_over_time=trend_visitors,
            engagement_over_time=trend_engagement,
            lead_generation_over_time=trend_leads,
        ),
        generated_at=datetime.now(timezone.utc),
    )


async def get_organizer_overall_summary(organizer_id: str) -> OrganizerSummaryResponse:
    """Aggregate metrics across ALL events for an organizer."""
    db = get_database()
    
    # Get all event IDs for this organizer
    cursor = db["events"].find({"organizer_id": organizer_id}, {"_id": 1})
    event_docs = await cursor.to_list(length=None)
    event_ids = [str(d["_id"]) for d in event_docs]
    
    if not event_ids:
        return OrganizerSummaryResponse(
            overview=OverviewMetrics(total_visitors=0, enterprise_participation_rate=0, stand_engagement_score=0, 
                                    leads_generated=0, meetings_booked=0, chat_interactions=0, revenue_summary=RevenueSummary()),
            safety=SafetyMetrics(total_flags=0, resolved_flags=0, resolution_rate=0.0),
            performance_trends=PerformanceTrends(visitors_over_time=[], engagement_over_time=[], lead_generation_over_time=[]),
            generated_at=datetime.now(timezone.utc)
        )

    # Parallel phase 1 — gather stand IDs
    stand_ids = await _stand_ids_for_events(db, event_ids)

    # Parallel phase 2
    (
        (approved_visitors, approved_enterprises),
        ent_rate,
        leads,
        meetings,
        chat,
        safety,
        trend_visitors,
        trend_engagement,
        trend_leads,
        enterprises,
    ) = await asyncio.gather(
        _visitor_counts(db, event_ids),
        _enterprise_rate(db, event_ids),
        _leads_count(db, stand_ids),
        _meetings_count(db, stand_ids),
        _chat_count(db, event_ids),
        _safety_metrics(db, event_ids),
        _trend_participants(db, event_ids),
        _trend_engagement(event_ids),
        _trend_leads(db, stand_ids),
        _get_participating_enterprises(db, event_ids),
    )

    engagement_score = await _stand_engagement_score(db, event_ids, stand_ids, meetings)
    revenue = await _revenue(db, event_ids, approved_visitors, approved_enterprises)

    return OrganizerSummaryResponse(
        overview=OverviewMetrics(
            total_visitors=approved_visitors,
            enterprise_participation_rate=ent_rate,
            stand_engagement_score=engagement_score,
            leads_generated=leads,
            meetings_booked=meetings,
            chat_interactions=chat,
            revenue_summary=revenue,
        ),
        safety=safety,
        performance_trends=PerformanceTrends(
            visitors_over_time=trend_visitors,
            engagement_over_time=trend_engagement,
            lead_generation_over_time=trend_leads,
        ),
        enterprises=enterprises,
        generated_at=datetime.now(timezone.utc),
    )
