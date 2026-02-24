"""
Incidents service — CRUD for incidents and content flags.
"""
from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId

from ...db.mongo import get_database
from .schemas import IncidentSeverity, IncidentStatus


def _normalize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id", ""))
    return doc


async def create_incident(
    title: str,
    description: Optional[str],
    severity: IncidentSeverity,
) -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)
    record = {
        "title": title,
        "description": description,
        "severity": severity.value,
        "status": IncidentStatus.OPEN.value,
        "notes": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["incidents"].insert_one(record)
    record["_id"] = result.inserted_id
    return _normalize(record)


async def list_incidents(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
) -> List[dict]:
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    cursor = db["incidents"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    return [_normalize(doc) async for doc in cursor]


async def get_incident(incident_id: str) -> Optional[dict]:
    db = get_database()
    doc = await db["incidents"].find_one({"_id": ObjectId(incident_id)})
    return _normalize(doc) if doc else None


async def update_incident(
    incident_id: str,
    updates: dict,
) -> Optional[dict]:
    db = get_database()
    updates["updated_at"] = datetime.now(timezone.utc)
    await db["incidents"].update_one(
        {"_id": ObjectId(incident_id)},
        {"$set": updates},
    )
    return await get_incident(incident_id)


async def create_flag(
    entity_type: str,
    entity_id: str,
    reason: str,
    details: Optional[str],
    reporter_id: Optional[str],
) -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)
    record = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "reason": reason,
        "details": details,
        "reporter_id": reporter_id,
        "created_at": now,
    }
    result = await db["content_flags"].insert_one(record)
    record["_id"] = result.inserted_id
    return _normalize(record)


async def list_flags(limit: int = 50) -> List[dict]:
    db = get_database()
    cursor = db["content_flags"].find({}).sort("created_at", -1).limit(limit)
    return [_normalize(doc) async for doc in cursor]
