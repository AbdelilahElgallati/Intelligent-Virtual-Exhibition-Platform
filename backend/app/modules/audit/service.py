"""
Audit log service — log_audit helper + query support.
"""
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from bson import ObjectId

from ...db.mongo import get_database


def _normalize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id", ""))
    return doc


async def log_audit(
    actor_id: str,
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """Insert an audit log entry into the audit_logs collection."""
    db = get_database()
    record = {
        "actor_id": actor_id,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "timestamp": datetime.now(timezone.utc),
        "metadata": metadata or {},
    }
    result = await db["audit_logs"].insert_one(record)
    record["_id"] = result.inserted_id
    return _normalize(record)


async def list_audit_logs(
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    entity: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100,
    skip: int = 0,
) -> list[dict]:
    db = get_database()
    query: Dict[str, Any] = {}
    if actor_id:
        query["actor_id"] = actor_id
    if action:
        query["action"] = action
    if entity:
        query["entity"] = entity
    if from_date or to_date:
        ts_filter: Dict[str, Any] = {}
        if from_date:
            ts_filter["$gte"] = from_date
        if to_date:
            ts_filter["$lte"] = to_date
        query["timestamp"] = ts_filter

    cursor = db["audit_logs"].find(query).sort("timestamp", -1).skip(skip).limit(limit)
    docs = []
    async for doc in cursor:
        docs.append(_normalize(doc))
    return docs


async def count_audit_logs(
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    entity: Optional[str] = None,
) -> int:
    db = get_database()
    query: Dict[str, Any] = {}
    if actor_id:
        query["actor_id"] = actor_id
    if action:
        query["action"] = action
    if entity:
        query["entity"] = entity
    return await db["audit_logs"].count_documents(query)
