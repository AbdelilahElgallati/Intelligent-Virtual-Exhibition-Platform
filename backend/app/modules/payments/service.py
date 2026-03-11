"""
Payment service for IVEP.

Provides MongoDB-backed event payment storage and operations (Payzone-based).
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
    currency: str = "mad",
    payzone_payment_id: str = "",
) -> dict:
    """Create a new pending payment record for Payzone checkout."""
    now = datetime.now(timezone.utc)

    payment = {
        "event_id": str(event_id),
        "user_id": str(user_id),
        "amount": amount,
        "currency": currency,
        "payzone_payment_id": payzone_payment_id,
        "payzone_transaction_id": None,
        "status": PaymentStatus.PENDING,
        "created_at": now,
        "paid_at": None,
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


async def get_payment_by_payzone_id(payment_id: str) -> Optional[dict]:
    """Get a payment by Payzone payment ID."""
    collection = get_payments_collection()
    doc = await collection.find_one({"payzone_payment_id": payment_id})
    return stringify_object_ids(doc) if doc else None


async def mark_payment_paid(
    payment_id: str,
    payzone_transaction_id: str = "",
) -> Optional[dict]:
    """Mark a payment as paid after Payzone confirmation."""
    collection = get_payments_collection()
    updated = await collection.find_one_and_update(
        _id_query(payment_id),
        {
            "$set": {
                "status": PaymentStatus.PAID,
                "payzone_transaction_id": payzone_transaction_id,
                "paid_at": datetime.now(timezone.utc),
            }
        },
        return_document=True,
    )
    return stringify_object_ids(updated) if updated else None


async def list_payments(
    status_filter: Optional[PaymentStatus] = None,
    event_id: Optional[str] = None,
) -> List[dict]:
    """List payments, optionally filtered by status and/or event."""
    collection = get_payments_collection()
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if event_id:
        query["event_id"] = str(event_id)

    cursor = collection.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    return stringify_object_ids(docs)


async def get_payment_by_id(payment_id: str) -> Optional[dict]:
    """Get a single payment by _id."""
    collection = get_payments_collection()
    doc = await collection.find_one(_id_query(payment_id))
    return stringify_object_ids(doc) if doc else None
