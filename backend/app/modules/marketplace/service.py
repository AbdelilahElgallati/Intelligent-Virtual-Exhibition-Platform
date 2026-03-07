"""
Marketplace service — CRUD for stand products & orders.
Uses Motor (async MongoDB) directly, same pattern as other modules.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_database


# ── Helpers ─────────────────────────────────────────────────────────

def _oid(value: str) -> ObjectId:
    return ObjectId(value)


def _serialize(doc: dict) -> dict:
    """Convert MongoDB document _id → id string."""
    if doc is None:
        return doc
    doc["id"] = str(doc.pop("_id"))
    # stringify any remaining ObjectId fields
    for key in ("stand_id", "product_id", "buyer_id"):
        if isinstance(doc.get(key), ObjectId):
            doc[key] = str(doc[key])
    return doc


def _db() -> AsyncIOMotorDatabase:
    return get_database()


# ── Products ────────────────────────────────────────────────────────

async def create_product(stand_id: str, data: dict) -> dict:
    doc = {
        "stand_id": _oid(stand_id),
        "name": data["name"],
        "description": data.get("description", ""),
        "price": data["price"],
        "currency": data.get("currency", "usd"),
        "image_url": data.get("image_url", ""),
        "stock": data.get("stock", 0),
        "created_at": datetime.now(timezone.utc),
    }
    result = await _db().stand_products.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def list_products(stand_id: str) -> list[dict]:
    cursor = _db().stand_products.find({"stand_id": _oid(stand_id)}).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]


async def get_product(product_id: str) -> Optional[dict]:
    doc = await _db().stand_products.find_one({"_id": _oid(product_id)})
    return _serialize(doc) if doc else None


async def update_product(product_id: str, data: dict) -> Optional[dict]:
    data = {k: v for k, v in data.items() if v is not None}
    if not data:
        return await get_product(product_id)
    await _db().stand_products.update_one({"_id": _oid(product_id)}, {"$set": data})
    return await get_product(product_id)


async def delete_product(product_id: str) -> bool:
    result = await _db().stand_products.delete_one({"_id": _oid(product_id)})
    return result.deleted_count == 1


async def decrement_stock(product_id: str, qty: int) -> None:
    await _db().stand_products.update_one(
        {"_id": _oid(product_id)},
        {"$inc": {"stock": -qty}},
    )


# ── Orders ──────────────────────────────────────────────────────────

async def create_order(
    product_id: str,
    stand_id: str,
    buyer_id: str,
    product_name: str,
    quantity: int,
    total_amount: float,
    stripe_session_id: str = "",
) -> dict:
    doc = {
        "product_id": _oid(product_id),
        "stand_id": _oid(stand_id),
        "buyer_id": _oid(buyer_id),
        "product_name": product_name,
        "quantity": quantity,
        "total_amount": total_amount,
        "stripe_payment_intent": "",
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "paid_at": None,
    }
    # Only include stripe_session_id if it has a real value;
    # sparse unique index skips documents where the field is absent.
    if stripe_session_id:
        doc["stripe_session_id"] = stripe_session_id
    result = await _db().stand_orders.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def get_order_by_stripe_session(session_id: str) -> Optional[dict]:
    doc = await _db().stand_orders.find_one({"stripe_session_id": session_id})
    return _serialize(doc) if doc else None


async def mark_order_paid(order_id: str, payment_intent: str) -> Optional[dict]:
    await _db().stand_orders.update_one(
        {"_id": _oid(order_id)},
        {
            "$set": {
                "status": "paid",
                "stripe_payment_intent": payment_intent,
                "paid_at": datetime.now(timezone.utc),
            }
        },
    )
    doc = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    return _serialize(doc) if doc else None


async def list_orders_for_stand(stand_id: str) -> list[dict]:
    cursor = _db().stand_orders.find({"stand_id": _oid(stand_id)}).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]


async def list_orders_for_buyer(buyer_id: str) -> list[dict]:
    cursor = _db().stand_orders.find({"buyer_id": _oid(buyer_id)}).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]
