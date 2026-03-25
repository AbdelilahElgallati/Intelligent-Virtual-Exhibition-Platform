"""
Marketplace service — CRUD for stand products, services & orders.
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


def _to_object_id(value: str) -> Optional[ObjectId]:
    if ObjectId.is_valid(value):
        return ObjectId(value)
    return None


def _db() -> AsyncIOMotorDatabase:
    return get_database()


# ── Products ────────────────────────────────────────────────────────

async def create_product(stand_id: str, data: dict) -> dict:
    product_type = str(data.get("type", "product") or "product")
    doc = {
        "stand_id": _oid(stand_id),
        "name": data["name"],
        "description": data.get("description", ""),
        "price": data["price"],
        "currency": data.get("currency", "MAD"),
        "image_url": data.get("image_url", ""),
        "stock": 0 if product_type == "service" else data.get("stock", 0),
        "type": product_type,
        "created_at": datetime.now(timezone.utc),
    }
    source_product_id = data.get("source_product_id")
    if source_product_id:
        source_oid = _to_object_id(str(source_product_id))
        doc["source_product_id"] = source_oid if source_oid else str(source_product_id)
    result = await _db().stand_products.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def list_products(
    stand_id: str,
    product_type: Optional[str] = None,
    source_product_ids: Optional[list[str]] = None,
) -> list[dict]:
    query: dict = {"stand_id": _oid(stand_id)}
    if product_type:
        query["type"] = product_type
    if source_product_ids:
        source_oids = [_to_object_id(pid) for pid in source_product_ids]
        source_oids = [oid for oid in source_oids if oid is not None]
        if not source_oids:
            return []
        query["source_product_id"] = {"$in": source_oids}
    cursor = _db().stand_products.find(query).sort("created_at", -1)
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
    if qty <= 0:
        return

    stand_product = await _db().stand_products.find_one(
        {"_id": _oid(product_id)},
        {"stock": 1, "type": 1, "source_product_id": 1, "stand_id": 1},
    )
    if not stand_product:
        return

    if str(stand_product.get("type") or "product") == "service":
        return

    await _db().stand_products.update_one(
        {"_id": stand_product["_id"]},
        {"$inc": {"stock": -qty}},
    )

    source_product_id = stand_product.get("source_product_id")
    if source_product_id:
        source_oid = source_product_id if isinstance(source_product_id, ObjectId) else _to_object_id(str(source_product_id))
        if source_oid:
            # Keep enterprise catalog stock aligned when stand products are linked to source catalog items.
            await _db().products.update_one(
                {"_id": source_oid},
                {"$inc": {"stock": -qty}},
            )

            stand_id = stand_product.get("stand_id")
            if stand_id:
                await _db().stands.update_one(
                    {
                        "_id": stand_id,
                        "product_links.product_id": str(source_oid),
                    },
                    {"$inc": {"product_links.$.quantity": -qty}},
                )


async def increment_stock(product_id: str, qty: int) -> None:
    if qty <= 0:
        return

    stand_product = await _db().stand_products.find_one(
        {"_id": _oid(product_id)},
        {"stock": 1, "type": 1, "source_product_id": 1, "stand_id": 1},
    )
    if not stand_product:
        return

    if str(stand_product.get("type") or "product") == "service":
        return

    await _db().stand_products.update_one(
        {"_id": stand_product["_id"]},
        {"$inc": {"stock": qty}},
    )

    source_product_id = stand_product.get("source_product_id")
    if source_product_id:
        source_oid = source_product_id if isinstance(source_product_id, ObjectId) else _to_object_id(str(source_product_id))
        if source_oid:
            await _db().products.update_one(
                {"_id": source_oid},
                {"$inc": {"stock": qty}},
            )

            stand_id = stand_product.get("stand_id")
            if stand_id:
                await _db().stands.update_one(
                    {
                        "_id": stand_id,
                        "product_links.product_id": str(source_oid),
                    },
                    {"$inc": {"product_links.$.quantity": qty}},
                )


# ── Orders ──────────────────────────────────────────────────────────

async def create_order(
    product_id: str,
    stand_id: str,
    buyer_id: str,
    product_name: str,
    quantity: int,
    total_amount: float,
    unit_price: float,
    currency: str = "MAD",
    payment_method: str = "stripe",
    stripe_session_id: str = "",
    checkout_group_id: str = "",
    shipping_address: str = "",
    delivery_notes: str = "",
    buyer_phone: str = "",
) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "product_id": _oid(product_id),
        "stand_id": _oid(stand_id),
        "buyer_id": _oid(buyer_id),
        "product_name": product_name,
        "quantity": quantity,
        "unit_price": unit_price,
        "total_amount": total_amount,
        "currency": (currency or "MAD").upper(),
        "payment_method": payment_method,
        "stripe_session_id": stripe_session_id,
        "checkout_group_id": checkout_group_id,
        "stripe_payment_intent_id": "",
        "status": "pending",
        "fulfillment_status": "requested",
        "fulfillment_note": "",
        "fulfillment_updated_at": now,
        "fulfillment_history": [
            {
                "status": "requested",
                "note": "",
                "changed_at": now,
            }
        ],
        "created_at": now,
        "paid_at": None,
        "shipping_address": shipping_address,
        "delivery_notes": delivery_notes,
        "buyer_phone": buyer_phone,
    }
    result = await _db().stand_orders.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def get_order_by_stripe_session(session_id: str) -> Optional[dict]:      
    doc = await _db().stand_orders.find_one({"stripe_session_id": session_id}) 
    return _serialize(doc) if doc else None


async def mark_order_paid(order_id: str, payment_intent_id: str = "") -> Optional[dict]:
    await _db().stand_orders.update_one(
        {"_id": _oid(order_id)},
        {"$set": {
            "status": "paid",
            "stripe_payment_intent_id": payment_intent_id,
            "paid_at": datetime.now(timezone.utc),
        }}
    )
    doc = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    return _serialize(doc) if doc else None


async def mark_order_paid_if_pending(order_id: str, payment_intent_id: str = "") -> tuple[Optional[dict], bool]:
    """Mark order as paid only if it is not already paid.

    Returns (order, changed) where changed=True means this call performed the status transition.
    """
    result = await _db().stand_orders.update_one(
        {
            "_id": _oid(order_id),
            "status": {"$ne": "paid"},
        },
        {
            "$set": {
                "status": "paid",
                "stripe_payment_intent_id": payment_intent_id,
                "paid_at": datetime.now(timezone.utc),
            }
        },
    )
    doc = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    return (_serialize(doc) if doc else None, result.modified_count == 1)


async def get_order(order_id: str) -> Optional[dict]:
    doc = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    return _serialize(doc) if doc else None


async def update_order_fulfillment_status(
    order_id: str,
    fulfillment_status: str,
    note: Optional[str] = None,
) -> Optional[dict]:
    now = datetime.now(timezone.utc)
    clean_note = (note or "").strip()
    await _db().stand_orders.update_one(
        {"_id": _oid(order_id)},
        {
            "$set": {
                "fulfillment_status": fulfillment_status,
                "fulfillment_note": clean_note,
                "fulfillment_updated_at": now,
            },
            "$push": {
                "fulfillment_history": {
                    "status": fulfillment_status,
                    "note": clean_note,
                    "changed_at": now,
                }
            },
        },
    )
    doc = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    return _serialize(doc) if doc else None


async def cancel_order(
    order_id: str,
    note: Optional[str] = None,
) -> Optional[dict]:
    existing = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    if not existing:
        return None

    # Idempotent: if already cancelled, just return the current state.
    if str(existing.get("status") or "") == "cancelled":
        return _serialize(existing)

    now = datetime.now(timezone.utc)
    clean_note = (note or "Cancelled by stand owner").strip()
    qty = int(existing.get("quantity") or 0)
    product_id = existing.get("product_id")
    was_paid = str(existing.get("status") or "") == "paid"

    # Restore stock only for already-paid product orders.
    if was_paid and product_id and qty > 0:
        await increment_stock(str(product_id), qty)

    await _db().stand_orders.update_one(
        {"_id": _oid(order_id)},
        {
            "$set": {
                "status": "cancelled",
                "fulfillment_status": "cancelled",
                "fulfillment_note": clean_note,
                "fulfillment_updated_at": now,
            },
            "$push": {
                "fulfillment_history": {
                    "status": "cancelled",
                    "note": clean_note,
                    "changed_at": now,
                }
            },
        },
    )
    doc = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    return _serialize(doc) if doc else None

async def list_orders_for_stand(stand_id: str) -> list[dict]:
    cursor = _db().stand_orders.find({"stand_id": _oid(stand_id)}).sort("created_at", -1)
    orders = [_serialize(d) async for d in cursor]
    if not orders:
        return orders

    buyer_ids: list[ObjectId] = []
    product_ids: list[ObjectId] = []
    for order in orders:
        buyer_oid = _to_object_id(order.get("buyer_id", ""))
        product_oid = _to_object_id(order.get("product_id", ""))
        if buyer_oid:
            buyer_ids.append(buyer_oid)
        if product_oid:
            product_ids.append(product_oid)

    users_map: dict[str, dict] = {}
    products_map: dict[str, dict] = {}

    if buyer_ids:
        user_cursor = _db().users.find(
            {"_id": {"$in": buyer_ids}},
            {"full_name": 1, "name": 1, "email": 1},
        )
        users_map = {str(doc["_id"]): doc async for doc in user_cursor}

    if product_ids:
        product_cursor = _db().stand_products.find(
            {"_id": {"$in": product_ids}},
            {"type": 1},
        )
        products_map = {str(doc["_id"]): doc async for doc in product_cursor}

    for order in orders:
        if not order.get("fulfillment_status"):
            order["fulfillment_status"] = "requested"
        if "fulfillment_note" not in order:
            order["fulfillment_note"] = ""
        if "fulfillment_history" not in order or not isinstance(order.get("fulfillment_history"), list):
            order["fulfillment_history"] = []

        buyer = users_map.get(order.get("buyer_id", ""), {})
        order["buyer_name"] = str(buyer.get("full_name") or buyer.get("name") or "")
        order["buyer_email"] = str(buyer.get("email") or "")

        product = products_map.get(order.get("product_id", ""), {})
        order["product_type"] = str(product.get("type") or "product")

    return orders


async def list_orders_for_buyer(buyer_id: str, session_id: str = None) -> list[dict]:
    query = {"buyer_id": _oid(buyer_id)}
    if session_id:
        query["stripe_session_id"] = session_id
    cursor = _db().stand_orders.find(query).sort("created_at", -1)
    orders = [_serialize(d) async for d in cursor]
    if not orders:
        return orders

    product_ids: list[ObjectId] = []
    for order in orders:
        product_oid = _to_object_id(order.get("product_id", ""))
        if product_oid:
            product_ids.append(product_oid)

    products_map: dict[str, dict] = {}
    if product_ids:
        product_cursor = _db().stand_products.find(
            {"_id": {"$in": product_ids}},
            {"type": 1},
        )
        products_map = {str(doc["_id"]): doc async for doc in product_cursor}

    for order in orders:
        product = products_map.get(order.get("product_id", ""), {})
        order["product_type"] = str(product.get("type") or "product")

    return orders


async def list_unified_orders_for_buyer(
    buyer_id: str,
    session_id: str | None = None,
    group_id: str | None = None,
) -> list[dict]:
    query: dict = {"buyer_id": _oid(buyer_id)}
    if session_id:
        query["stripe_session_id"] = session_id
    if group_id:
        if group_id.startswith("session:"):
            query["stripe_session_id"] = group_id.split(":", 1)[1]
        elif group_id.startswith("group:"):
            query["checkout_group_id"] = group_id.split(":", 1)[1]
        else:
            query["$or"] = [
                {"checkout_group_id": group_id},
                {"stripe_session_id": group_id},
            ]

    raw_orders = [d async for d in _db().stand_orders.find(query).sort("created_at", -1)]
    if not raw_orders:
        return []

    orders = [_serialize(d) for d in raw_orders]

    product_ids: list[ObjectId] = []
    stand_ids: list[ObjectId] = []
    for order in orders:
        product_oid = _to_object_id(order.get("product_id", ""))
        stand_oid = _to_object_id(order.get("stand_id", ""))
        if product_oid:
            product_ids.append(product_oid)
        if stand_oid:
            stand_ids.append(stand_oid)

    products_map: dict[str, dict] = {}
    stands_map: dict[str, dict] = {}
    if product_ids:
        product_cursor = _db().stand_products.find(
            {"_id": {"$in": product_ids}},
            {"type": 1},
        )
        products_map = {str(doc["_id"]): doc async for doc in product_cursor}

    if stand_ids:
        stand_cursor = _db().stands.find(
            {"_id": {"$in": stand_ids}},
            {"name": 1, "event_id": 1},
        )
        stands_map = {str(doc["_id"]): doc async for doc in stand_cursor}

    grouped: dict[str, dict] = {}
    for order in orders:
        product = products_map.get(order.get("product_id", ""), {})
        stand = stands_map.get(order.get("stand_id", ""), {})

        order["product_type"] = str(product.get("type") or "product")

        stripe_session = str(order.get("stripe_session_id") or "").strip()
        checkout_group = str(order.get("checkout_group_id") or "").strip()
        if stripe_session:
            key = f"session:{stripe_session}"
        elif checkout_group:
            key = f"group:{checkout_group}"
        else:
            key = f"order:{order['id']}"

        created_at = order.get("created_at")
        paid_at = order.get("paid_at")
        if key not in grouped:
            grouped[key] = {
                "group_id": key,
                "stripe_session_id": stripe_session,
                "checkout_group_id": checkout_group,
                "stand_id": order.get("stand_id", ""),
                "stand_name": str(stand.get("name") or "Stand"),
                "event_id": str(stand.get("event_id") or ""),
                "buyer_id": order.get("buyer_id", ""),
                "payment_method": order.get("payment_method", "stripe"),
                "status": order.get("status", "pending"),
                "currency": str(order.get("currency") or "MAD").upper(),
                "total_amount": 0.0,
                "order_count": 0,
                "shipping_address": order.get("shipping_address", "") or "",
                "delivery_notes": order.get("delivery_notes", "") or "",
                "buyer_phone": order.get("buyer_phone", "") or "",
                "created_at": created_at,
                "paid_at": paid_at,
                "items": [],
                "order_ids": [],
            }

        group = grouped[key]
        amount = float(order.get("total_amount") or 0)
        group["total_amount"] += amount
        group["order_count"] += 1
        group["order_ids"].append(order["id"])
        group["items"].append({
            "order_id": order["id"],
            "product_id": order.get("product_id", ""),
            "product_name": order.get("product_name", ""),
            "product_type": order.get("product_type", "product"),
            "quantity": int(order.get("quantity") or 1),
            "unit_price": float(order.get("unit_price") or 0),
            "total_amount": amount,
            "currency": str(order.get("currency") or "MAD").upper(),
            "status": order.get("status", "pending"),
            "fulfillment_status": order.get("fulfillment_status", "requested"),
            "created_at": created_at,
        })

        # Keep the most advanced payment state for a checkout group.
        status_rank = {"pending": 0, "paid": 1, "cancelled": 2}
        current_rank = status_rank.get(str(group.get("status") or "pending"), 0)
        incoming_rank = status_rank.get(str(order.get("status") or "pending"), 0)
        if incoming_rank > current_rank:
            group["status"] = order.get("status", "pending")

        if isinstance(created_at, datetime):
            group_created = group.get("created_at")
            if not isinstance(group_created, datetime) or created_at < group_created:
                group["created_at"] = created_at

        if isinstance(paid_at, datetime):
            group_paid = group.get("paid_at")
            if not isinstance(group_paid, datetime) or paid_at > group_paid:
                group["paid_at"] = paid_at

    result = list(grouped.values())
    result.sort(
        key=lambda g: (
            g.get("created_at").timestamp() if isinstance(g.get("created_at"), datetime) else 0
        ),
        reverse=True,
    )
    return result
