"""
Payment service for IVEP.

Provides MongoDB-backed event payment storage and operations.
"""

from datetime import datetime, timezone
from typing import Optional, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.payments.schemas import PaymentStatus


def _id_query(pid) -> dict:
    s = str(pid)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def get_payments_collection() -> AsyncIOMotorCollection:
    """Get the event_payments collection from MongoDB."""
    db = get_database()
    return db["event_payments"]


async def create_payment(
    event_id: str,
    user_id: str,
    amount: float,
    proof_file_path: str,
) -> dict:
    """Create a new pending payment proof record."""
    now = datetime.now(timezone.utc)

    payment = {
        "event_id": str(event_id),
        "user_id": str(user_id),
        "amount": amount,
        "proof_file_path": proof_file_path,
        "status": PaymentStatus.PENDING,
        "admin_note": None,
        "created_at": now,
        "reviewed_at": None,
    }

    collection = get_payments_collection()
    result = await collection.insert_one(payment)
    payment["_id"] = result.inserted_id
    return stringify_object_ids(payment)


async def get_user_payment(event_id: str, user_id: str) -> Optional[dict]:
    """Get the latest payment record for a user/event pair."""
    collection = get_payments_collection()
    doc = await collection.find_one(
        {"event_id": str(event_id), "user_id": str(user_id)},
        sort=[("created_at", -1)],
    )
    return stringify_object_ids(doc) if doc else None


async def get_user_payment_by_status(
    event_id: str, user_id: str, status: PaymentStatus
) -> Optional[dict]:
    """Get a payment record with a specific status for a user/event pair."""
    collection = get_payments_collection()
    doc = await collection.find_one(
        {"event_id": str(event_id), "user_id": str(user_id), "status": status}
    )
    return stringify_object_ids(doc) if doc else None


async def list_payments(
    status_filter: Optional[PaymentStatus] = None,
) -> List[dict]:
    """List payments, optionally filtered by status."""
    collection = get_payments_collection()
    query = {}
    if status_filter:
        query["status"] = status_filter

    cursor = collection.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    return stringify_object_ids(docs)


async def get_payment_by_id(payment_id: str) -> Optional[dict]:
    """Get a single payment by _id."""
    collection = get_payments_collection()
    doc = await collection.find_one(_id_query(payment_id))
    return stringify_object_ids(doc) if doc else None


async def update_payment_status(
    payment_id: str,
    status: PaymentStatus,
    admin_note: Optional[str] = None,
) -> Optional[dict]:
    """Update payment status and set reviewed_at timestamp."""
    collection = get_payments_collection()
    update_fields: dict = {
        "status": status,
        "reviewed_at": datetime.now(timezone.utc),
    }
    if admin_note is not None:
        update_fields["admin_note"] = admin_note

    updated = await collection.find_one_and_update(
        _id_query(payment_id),
        {"$set": update_fields},
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None
