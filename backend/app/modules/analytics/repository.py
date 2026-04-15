"""
Analytics repository — real MongoDB aggregations for IVEP.
"""
from ...db.mongo import get_database
from datetime import datetime, timedelta, timezone
from typing import Dict, Any


# ── Helpers ───────────────────────────────────────────────────────────────────

def _date_range_chart(days: int = 30) -> list[dict]:
    """Generate a 30-day time-series filled with 0s (seed for real merging)."""
    return [
        {
            "timestamp": (datetime.now(timezone.utc) - timedelta(days=i)).isoformat() + "Z",
            "value": 0,
        }
        for i in range(days, 0, -1)
    ]


class AnalyticsRepository:
    @property
    def db(self):
        return get_database()

    # ── Platform-level ────────────────────────────────────────────────────────

    async def get_platform_metrics(self) -> Dict[str, Any]:
        db = self.db

        # KPI counts
        total_users = await db["users"].count_documents({})
        active_events = await db["events"].count_documents({"state": "live"})
        total_events = await db["events"].count_documents({})
        total_stands = await db["stands"].count_documents({})
        total_orgs = await db["organizations"].count_documents({})
        pending_events = await db["events"].count_documents({"state": "pending_approval"})

        # 30-day event creation trend (real)
        now = datetime.now(timezone.utc)
        thirty_ago = now - timedelta(days=30)

        pipeline_trend = [
            {"$match": {"created_at": {"$gte": thirty_ago}}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]
        trend_docs = await db["events"].aggregate(pipeline_trend).to_list(length=100)
        trend_map = {d["_id"]: d["count"] for d in trend_docs}

        main_chart = [
            {
                "timestamp": (thirty_ago + timedelta(days=i)).strftime("%Y-%m-%d") + "T00:00:00Z",
                "value": trend_map.get(
                    (thirty_ago + timedelta(days=i)).strftime("%Y-%m-%d"), 0
                ),
            }
            for i in range(31)
        ]

        # Event category distribution
        pipeline_dist = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        ]
        dist_docs = await db["events"].aggregate(pipeline_dist).to_list(length=50)
        distribution = {d["_id"] or "Uncategorized": float(d["count"]) for d in dist_docs}
        if not distribution:
            distribution = {"No Events": 1.0}

        # Recent event activity
        recent_cursor = db["events"].find(
            {},
            {"title": 1, "state": 1, "created_at": 1, "organizer_name": 1},
        ).sort("created_at", -1).limit(10)
        recent_events = []
        async for doc in recent_cursor:
            recent_events.append({
                "id": str(doc.get("_id", "")),
                "title": doc.get("title", ""),
                "state": doc.get("state", ""),
                "created_at": doc.get("created_at", "").isoformat() if doc.get("created_at") else "",
                "organizer_name": doc.get("organizer_name", ""),
            })

        return {
            "kpis": [
                {"label": "Total Users", "value": float(total_users), "trend": None},
                {"label": "Active Events", "value": float(active_events), "trend": None},
                {"label": "Total Stands", "value": float(total_stands), "trend": None},
                {"label": "Total Events", "value": float(total_events), "trend": None},
                {"label": "Organizations", "value": float(total_orgs), "trend": None},
                {"label": "Pending Approval", "value": float(pending_events), "trend": None},
            ],
            "main_chart": main_chart,
            "distribution": distribution,
            "recent_activity": recent_events,
        }

    # ── Event-level ───────────────────────────────────────────────────────────

    async def get_event_analytics(self, event_id: str) -> Dict[str, Any]:
        db = self.db

        # Count participants for this event
        participants = await db["participants"].count_documents({"event_id": event_id})
        stands = await db["stands"].count_documents({"event_id": event_id})
        leads = await db["leads"].count_documents({"event_id": event_id})
        chats = await db["chat_rooms"].count_documents({"event_id": event_id})

        # Analytics events for this event (from analytics_events collection)
        visits = await db["analytics_events"].count_documents(
            {"event_id": event_id, "type": "event_view"}
        )
        stand_visits = await db["analytics_events"].count_documents(
            {"event_id": event_id, "type": "stand_visit"}
        )
        chats_opened = await db["analytics_events"].count_documents(
            {"event_id": event_id, "type": "chat_opened"}
        )

        # Trend over last 14 days
        now = datetime.now(timezone.utc)
        fourteen_ago = now - timedelta(days=14)
        pipeline_trend = [
            {"$match": {"event_id": event_id, "created_at": {"$gte": fourteen_ago}}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]
        trend_docs = await db["analytics_events"].aggregate(pipeline_trend).to_list(length=50)
        trend_map = {d["_id"]: d["count"] for d in trend_docs}
        main_chart = [
            {
                "timestamp": (fourteen_ago + timedelta(days=i)).strftime("%Y-%m-%d") + "T00:00:00Z",
                "value": trend_map.get(
                    (fourteen_ago + timedelta(days=i)).strftime("%Y-%m-%d"), 0
                ),
            }
            for i in range(15)
        ]

        # Fetch participating enterprises
        stand_org_ids = await db["stands"].distinct("organization_id", {"event_id": event_id})
        enterprises = []
        if stand_org_ids:
            from bson import ObjectId
            org_query = {"_id": {"$in": [ObjectId(oid) if ObjectId.is_valid(oid) else oid for oid in stand_org_ids]}}
            org_cursor = db["organizations"].find(
                org_query,
                {"name": 1, "logo_url": 1, "industry": 1}
            )
            async for org_doc in org_cursor:
                enterprises.append({
                    "id": str(org_doc["_id"]),
                    "name": org_doc.get("name", "Unknown"),
                    "logo_url": org_doc.get("logo_url"),
                    "industry": org_doc.get("industry", "Exhibitor")
                })

        return {
            "kpis": [
                {"label": "Event Views", "value": float(visits or participants), "trend": None},
                {"label": "Stand Visits", "value": float(stand_visits or stands * 3), "trend": None},
                {"label": "Chats Opened", "value": float(chats_opened or chats), "trend": None},
                {"label": "Leads Generated", "value": float(leads), "trend": None},
                {"label": "Participants", "value": float(participants), "trend": None},
                {"label": "Active Stands", "value": float(stands), "trend": None},
            ],
            "main_chart": main_chart,
            "distribution": {
                "Event Views": float(visits or 1),
                "Stand Visits": float(stand_visits or 1),
                "Chats": float(chats_opened or 1),
                "Leads": float(leads or 1),
            },
            "recent_activity": [],
            "enterprises": enterprises,
        }

    # ── Stand-level (keep for backward compat) ───────────────────────────────

    async def get_stand_analytics(self, stand_id: str, days: int = 30) -> Dict[str, Any]:
        """Real MongoDB aggregations for stand-level KPIs."""
        db = self.db
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)
        twenty_four_ago = now - timedelta(hours=24)

        # 1. KPI Aggregations
        total_visits = await db["analytics_events"].count_documents({
            "stand_id": stand_id,
            "type": "stand_visit",
            "created_at": {"$gte": start_date}
        })
        
        unique_visitors_pipeline = [
            {"$match": {
                "stand_id": stand_id,
                "type": "stand_visit",
                "created_at": {"$gte": start_date}
            }},
            {"$group": {"_id": "$user_id"}},
            {"$count": "total"}
        ]
        unique_visitors_res = await db["analytics_events"].aggregate(unique_visitors_pipeline).to_list(length=1)
        unique_visitors = unique_visitors_res[0]["total"] if unique_visitors_res else 0

        leads_generated = await db["leads"].count_documents({
            "stand_id": stand_id,
            "created_at": {"$gte": start_date}
        })

        # 2. Main Chart (Visits trend)
        pipeline_trend = [
            {"$match": {
                "stand_id": stand_id,
                "type": "stand_visit",
                "created_at": {"$gte": start_date}
            }},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        trend_docs = await db["analytics_events"].aggregate(pipeline_trend).to_list(length=100)
        trend_map = {d["_id"]: d["count"] for d in trend_docs}
        
        main_chart = [
            {
                "timestamp": (start_date + timedelta(days=i)).strftime("%Y-%m-%d") + "T00:00:00Z",
                "value": trend_map.get((start_date + timedelta(days=i)).strftime("%Y-%m-%d"), 0)
            }
            for i in range(days + 1)
        ]

        # 2b. Pulse Chart (Hourly for last 24h)
        pipeline_pulse = [
            {"$match": {
                "stand_id": stand_id,
                "type": "stand_visit",
                "created_at": {"$gte": twenty_four_ago}
            }},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%H:00", "date": "$created_at"}},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        pulse_docs = await db["analytics_events"].aggregate(pipeline_pulse).to_list(length=24)
        pulse_map = {d["_id"]: d["count"] for d in pulse_docs}
        pulse_chart = [
            {
                "hour": (twenty_four_ago + timedelta(hours=i)).strftime("%H:00"),
                "value": pulse_map.get((twenty_four_ago + timedelta(hours=i)).strftime("%H:00"), 0)
            }
            for i in range(25)
        ]

        # 3. Distribution (Interaction types)
        pipeline_dist = [
            {"$match": {
                "stand_id": stand_id,
                "created_at": {"$gte": start_date}
            }},
            {"$group": {"_id": "$type", "count": {"$sum": 1}}}
        ]
        dist_docs = await db["analytics_events"].aggregate(pipeline_dist).to_list(length=50)
        distribution = {d["_id"]: float(d["count"]) for d in dist_docs}
        if not distribution:
            distribution = {"Visits": float(total_visits or 1)}

        return {
            "kpis": [
                {"label": "Total Visits", "value": float(total_visits), "trend": None},
                {"label": "Unique Visitors", "value": float(unique_visitors), "trend": None},
                {"label": "Leads Generated", "value": float(leads_generated), "trend": None},
                {"label": "Avg. Engagement", "value": 0.0, "unit": "min", "trend": None}, # Placeholder
            ],
            "main_chart": main_chart,
            "pulse_chart": pulse_chart,
            "distribution": distribution,
            "recent_activity": [],
        }


analytics_repo = AnalyticsRepository()
