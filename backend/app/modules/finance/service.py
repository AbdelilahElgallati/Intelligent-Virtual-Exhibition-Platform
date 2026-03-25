from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pymongo import ReturnDocument

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.finance.schemas import FinancialTransaction


def _to_str(value) -> str:
    if value is None:
        return ""
    return str(value)


def _normalize_transaction_status(value: str | None) -> str:
    status = (value or "").lower()
    if status == "paid":
        return "paid"
    if status in {"pending", "requested", "processing"}:
        return "pending"
    if status in {"failed", "cancelled", "canceled", "rejected"}:
        return "failed"
    return "pending"


def _to_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    return None


def _id_query(value: str) -> dict:
    s = _to_str(value)
    return {"_id": ObjectId(s)} if ObjectId.is_valid(s) else {"_id": s}


def _sort_key(tx: FinancialTransaction):
    dt = tx.created_at or tx.paid_at
    if dt is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    return dt


def get_payouts_collection():
    return get_database()["payouts"]


def _resolve_actor_name(
    actor_id: str,
    user_map: dict[str, str],
    org_map: dict[str, str],
) -> str:
    if not actor_id:
        return ""
    return user_map.get(actor_id) or org_map.get(actor_id) or ""


async def _build_name_maps() -> tuple[dict[str, str], dict[str, str]]:
    db = get_database()

    user_docs = await db.users.find({}, {"full_name": 1, "email": 1}).to_list(length=20000)
    user_name_map: dict[str, str] = {}
    for u in user_docs:
        uid = _to_str(u.get("_id"))
        name = _to_str(u.get("full_name") or u.get("email"))
        if uid:
            user_name_map[uid] = name

    org_docs = await db.organizations.find({}, {"name": 1}).to_list(length=10000)
    org_name_map: dict[str, str] = {}
    for o in org_docs:
        oid = _to_str(o.get("_id"))
        name = _to_str(o.get("name"))
        if oid:
            org_name_map[oid] = name

    return user_name_map, org_name_map


def _attach_actor_names(
    transactions: list[FinancialTransaction],
    user_name_map: dict[str, str],
    org_name_map: dict[str, str],
) -> None:
    for tx in transactions:
        tx.metadata["payer_name"] = _resolve_actor_name(tx.payer_id, user_name_map, org_name_map)
        tx.metadata["receiver_name"] = _resolve_actor_name(tx.receiver_id, user_name_map, org_name_map)


async def _build_event_ticket_transactions() -> list[FinancialTransaction]:
    db = get_database()

    event_docs = await db.events.find({}, {"organizer_id": 1, "title": 1}).to_list(length=5000)
    event_map = {_to_str(e.get("_id")): e for e in event_docs}

    payment_docs = await db.event_payments.find({}).to_list(length=10000)

    transactions: list[FinancialTransaction] = []
    for p in payment_docs:
        pid = _to_str(p.get("_id"))
        event_id = _to_str(p.get("event_id"))
        event_doc = event_map.get(event_id)

        tx = FinancialTransaction(
            id=f"event_ticket:{pid}",
            source_type="event_ticket",
            reference_id=pid,
            amount=float(p.get("amount") or 0.0),
            currency=_to_str(p.get("currency") or "MAD").upper(),
            payer_id=_to_str(p.get("user_id")),
            receiver_type="organizer",
            receiver_id=_to_str(event_doc.get("organizer_id") if event_doc else ""),
            status=_normalize_transaction_status(_to_str(p.get("status"))),
            created_at=_to_datetime(p.get("created_at")),
            paid_at=_to_datetime(p.get("paid_at")),
            description=f"Event ticket payment for event {event_id}",
            metadata={
                "event_id": event_id,
                "event_title": _to_str(event_doc.get("title") if event_doc else ""),
                "stripe_session_id": _to_str(p.get("stripe_session_id")),
                "stripe_payment_intent_id": _to_str(p.get("stripe_payment_intent_id")),
            },
        )
        transactions.append(tx)

    return transactions


async def _build_marketplace_transactions() -> list[FinancialTransaction]:
    db = get_database()

    stand_docs = await db.stands.find({}, {"organization_id": 1, "event_id": 1, "name": 1}).to_list(length=5000)
    stand_map = {_to_str(s.get("_id")): s for s in stand_docs}

    org_docs = await db.organizations.find({}, {"owner_id": 1, "name": 1}).to_list(length=5000)
    org_map = {_to_str(o.get("_id")): o for o in org_docs}

    order_docs = await db.stand_orders.find({}).to_list(length=10000)

    # Group Stripe orders by checkout session for unified finance visibility.
    stripe_session_groups: dict[str, list[dict]] = {}
    standalone_orders: list[dict] = []
    for order in order_docs:
        payment_method = _to_str(order.get("payment_method")).lower()
        session_id = _to_str(order.get("stripe_session_id"))
        if payment_method == "stripe" and session_id:
            stripe_session_groups.setdefault(session_id, []).append(order)
        else:
            standalone_orders.append(order)

    # Keep single Stripe-item checkouts as standalone rows for backward compatibility.
    for session_id, grouped_orders in list(stripe_session_groups.items()):
        if len(grouped_orders) == 1:
            standalone_orders.extend(grouped_orders)
            stripe_session_groups.pop(session_id, None)

    transactions: list[FinancialTransaction] = []

    # 1) Unified multi-item Stripe checkout rows (one row per session)
    for session_id, grouped_orders in stripe_session_groups.items():
        first = grouped_orders[0]
        first_stand_id = _to_str(first.get("stand_id"))
        stand_doc = stand_map.get(first_stand_id)
        org_id = _to_str(stand_doc.get("organization_id") if stand_doc else "")
        org_doc = org_map.get(org_id)

        receiver_id = _to_str(org_doc.get("owner_id") if org_doc else org_id)
        payer_id = _to_str(first.get("buyer_id"))
        currency = _to_str(first.get("currency") or "MAD").upper()

        total_amount = 0.0
        total_quantity = 0
        order_ids: list[str] = []
        product_names: list[str] = []
        created_values: list[datetime] = []
        paid_values: list[datetime] = []
        normalized_statuses: list[str] = []
        payment_intent_id = ""

        for order in grouped_orders:
            total_amount += float(order.get("total_amount") or 0.0)
            total_quantity += int(order.get("quantity") or 1)
            order_ids.append(_to_str(order.get("_id")))
            product_names.append(_to_str(order.get("product_name")))
            normalized_statuses.append(_normalize_transaction_status(_to_str(order.get("status"))))

            created_at = _to_datetime(order.get("created_at"))
            if created_at:
                created_values.append(created_at)

            paid_at = _to_datetime(order.get("paid_at"))
            if paid_at:
                paid_values.append(paid_at)

            if not payment_intent_id:
                payment_intent_id = _to_str(order.get("stripe_payment_intent_id"))

        if all(s == "paid" for s in normalized_statuses):
            status = "paid"
        elif any(s == "pending" for s in normalized_statuses):
            status = "pending"
        elif any(s == "failed" for s in normalized_statuses):
            status = "failed"
        else:
            status = "pending"

        session_stand_ids = sorted({_to_str(o.get("stand_id")) for o in grouped_orders if _to_str(o.get("stand_id"))})
        session_event_ids = sorted({
            _to_str((stand_map.get(_to_str(o.get("stand_id"))) or {}).get("event_id"))
            for o in grouped_orders
            if _to_str((stand_map.get(_to_str(o.get("stand_id"))) or {}).get("event_id"))
        })
        session_org_ids = sorted({
            _to_str((stand_map.get(_to_str(o.get("stand_id"))) or {}).get("organization_id"))
            for o in grouped_orders
            if _to_str((stand_map.get(_to_str(o.get("stand_id"))) or {}).get("organization_id"))
        })

        tx = FinancialTransaction(
            id=f"marketplace_session:{session_id}",
            source_type="marketplace",
            reference_id=session_id,
            amount=total_amount,
            currency=currency,
            payer_id=payer_id,
            receiver_type="enterprise",
            receiver_id=receiver_id,
            status=status,
            created_at=min(created_values) if created_values else None,
            paid_at=max(paid_values) if paid_values else None,
            description=f"Marketplace checkout with {len(order_ids)} product(s)",
            metadata={
                "stand_id": first_stand_id,
                "stand_ids": session_stand_ids,
                "organization_id": org_id,
                "organization_ids": session_org_ids,
                "organization_name": _to_str(org_doc.get("name") if org_doc else ""),
                "event_id": _to_str(stand_doc.get("event_id") if stand_doc else ""),
                "event_ids": session_event_ids,
                "quantity": total_quantity,
                "payment_method": "stripe",
                "stripe_session_id": session_id,
                "stripe_payment_intent_id": payment_intent_id,
                "order_ids": order_ids,
                "product_names": product_names,
                "items_count": len(order_ids),
                "is_grouped_checkout": True,
            },
        )
        transactions.append(tx)

    # 2) Standalone rows (single-item Stripe or non-Stripe flows)
    for o in standalone_orders:
        payment_method = _to_str(o.get("payment_method")).lower()
        if payment_method != "stripe":
            continue

        oid = _to_str(o.get("_id"))
        stand_id = _to_str(o.get("stand_id"))
        stand_doc = stand_map.get(stand_id)
        org_id = _to_str(stand_doc.get("organization_id") if stand_doc else "")
        org_doc = org_map.get(org_id)

        receiver_id = _to_str(org_doc.get("owner_id") if org_doc else org_id)
        status = _normalize_transaction_status(_to_str(o.get("status")))

        tx = FinancialTransaction(
            id=f"marketplace:{oid}",
            source_type="marketplace",
            reference_id=oid,
            amount=float(o.get("total_amount") or 0.0),
            currency=_to_str(o.get("currency") or "MAD").upper(),
            payer_id=_to_str(o.get("buyer_id")),
            receiver_type="enterprise",
            receiver_id=receiver_id,
            status=status,
            created_at=_to_datetime(o.get("created_at")),
            paid_at=_to_datetime(o.get("paid_at")),
            description=f"Marketplace order { _to_str(o.get('product_name')) }",
            metadata={
                "stand_id": stand_id,
                "organization_id": org_id,
                "organization_name": _to_str(org_doc.get("name") if org_doc else ""),
                "event_id": _to_str(stand_doc.get("event_id") if stand_doc else ""),
                "quantity": int(o.get("quantity") or 1),
                "payment_method": _to_str(o.get("payment_method")),
                "stripe_session_id": _to_str(o.get("stripe_session_id")),
                "stripe_payment_intent_id": _to_str(o.get("stripe_payment_intent_id")),
            },
        )
        transactions.append(tx)

    return transactions


async def _build_stand_fee_transactions() -> list[FinancialTransaction]:
    db = get_database()

    event_docs = await db.events.find({}, {"stand_price": 1, "organizer_id": 1, "title": 1}).to_list(length=5000)
    event_map = {_to_str(e.get("_id")): e for e in event_docs}

    participant_docs = await db.participants.find({
        "$or": [
            {"stand_fee_paid": True},
            {"status": "pending_payment"},
            {"payment_reference": {"$exists": True, "$ne": ""}},
        ]
    }).to_list(length=10000)

    transactions: list[FinancialTransaction] = []
    for p in participant_docs:
        part_id = _to_str(p.get("_id"))
        event_id = _to_str(p.get("event_id"))
        event_doc = event_map.get(event_id)

        paid_flag = bool(p.get("stand_fee_paid")) or bool(p.get("payment_reference"))
        participant_status = _to_str(p.get("status"))

        if paid_flag:
            status = "paid"
        elif participant_status == "pending_payment":
            status = "pending"
        elif participant_status == "rejected":
            status = "failed"
        else:
            status = "pending"

        tx = FinancialTransaction(
            id=f"stand_fee:{part_id}",
            source_type="stand_fee",
            reference_id=part_id,
            amount=float((event_doc or {}).get("stand_price") or 0.0),
            currency="MAD",
            payer_id=_to_str(p.get("user_id") or p.get("organization_id")),
            receiver_type="organizer",
            receiver_id=_to_str((event_doc or {}).get("organizer_id")),
            status=status,
            created_at=_to_datetime(p.get("created_at")),
            paid_at=_to_datetime(p.get("updated_at")) if paid_flag else None,
            description=f"Stand fee for event {event_id}",
            metadata={
                "event_id": event_id,
                "event_title": _to_str((event_doc or {}).get("title")),
                "participant_id": part_id,
                "organization_id": _to_str(p.get("organization_id")),
                "participant_status": participant_status,
                "payment_reference": _to_str(p.get("payment_reference")),
                "stand_fee_paid": bool(p.get("stand_fee_paid")),
            },
        )
        transactions.append(tx)

    return transactions


async def _get_payout_status_by_transaction_id(transaction_ids: list[str]) -> dict[str, str]:
    if not transaction_ids:
        return {}

    docs = await get_payouts_collection().find({"transaction_id": {"$in": transaction_ids}}).to_list(length=20000)
    status_map: dict[str, str] = {}
    for d in docs:
        tx_id = _to_str(d.get("transaction_id"))
        payout_status = _to_str(d.get("status")).lower()
        if payout_status == "completed":
            status_map[tx_id] = "paid"
        elif payout_status == "pending":
            if status_map.get(tx_id) != "paid":
                status_map[tx_id] = "processing"
        elif tx_id not in status_map:
            status_map[tx_id] = "unpaid"

    return status_map


async def get_all_financial_transactions(
    source_type: Optional[str] = None,
    payout_status: Optional[str] = None,
    receiver_type: Optional[str] = None,
) -> list[FinancialTransaction]:
    transactions: list[FinancialTransaction] = []
    transactions.extend(await _build_event_ticket_transactions())
    transactions.extend(await _build_marketplace_transactions())
    transactions.extend(await _build_stand_fee_transactions())

    user_name_map, org_name_map = await _build_name_maps()
    _attach_actor_names(transactions, user_name_map, org_name_map)

    payout_map = await _get_payout_status_by_transaction_id([t.id for t in transactions])
    for tx in transactions:
        tx.payout_status = payout_map.get(tx.id, "unpaid")  # type: ignore[assignment]

    if source_type:
        transactions = [t for t in transactions if t.source_type == source_type]

    if payout_status:
        transactions = [t for t in transactions if t.payout_status == payout_status]

    if receiver_type:
        transactions = [t for t in transactions if t.receiver_type == receiver_type]

    transactions.sort(key=_sort_key, reverse=True)
    return transactions


async def get_financial_transaction_by_id(transaction_id: str) -> Optional[FinancialTransaction]:
    all_items = await get_all_financial_transactions()
    for tx in all_items:
        if tx.id == transaction_id:
            return tx
    return None


async def settle_transaction(
    transaction_id: str,
    admin_id: str,
    note: Optional[str] = None,
) -> tuple[dict, bool]:
    tx = await get_financial_transaction_by_id(transaction_id)
    if not tx:
        raise ValueError("Transaction not found")

    if tx.status != "paid":
        raise ValueError("Only paid transactions can be settled")

    payouts = get_payouts_collection()

    existing = await payouts.find_one({"transaction_id": transaction_id})
    now = datetime.now(timezone.utc)

    if existing and _to_str(existing.get("status")).lower() == "completed":
        return stringify_object_ids(existing), True

    if existing:
        update_doc = {
            "status": "completed",
            "processed_by": str(admin_id),
            "processed_at": now,
        }
        if note is not None:
            update_doc["note"] = note

        updated = await payouts.find_one_and_update(
            {"_id": existing["_id"]},
            {"$set": update_doc},
            return_document=ReturnDocument.AFTER,
        )
        return stringify_object_ids(updated), False

    insert_doc = {
        "transaction_id": transaction_id,
        "receiver_id": tx.receiver_id,
        "amount": tx.amount,
        "status": "completed",
        "note": note,
        "processed_by": str(admin_id),
        "processed_at": now,
    }
    result = await payouts.insert_one(insert_doc)
    insert_doc["_id"] = result.inserted_id
    return stringify_object_ids(insert_doc), False


async def list_payouts() -> list[dict]:
    docs = await get_payouts_collection().find({}).sort("processed_at", -1).to_list(length=5000)
    docs = stringify_object_ids(docs)

    user_name_map, org_name_map = await _build_name_maps()
    for d in docs:
        receiver_id = _to_str(d.get("receiver_id"))
        processed_by = _to_str(d.get("processed_by"))
        d["receiver_name"] = _resolve_actor_name(receiver_id, user_name_map, org_name_map)
        d["processed_by_name"] = user_name_map.get(processed_by, "")

    return docs


async def get_payout_by_id(payout_id: str) -> Optional[dict]:
    doc = await get_payouts_collection().find_one(_id_query(payout_id))
    return stringify_object_ids(doc) if doc else None


async def update_payout(
    payout_id: str,
    admin_id: str,
    note: Optional[str] = None,
    status: Optional[str] = None,
) -> Optional[dict]:
    update_doc: dict = {
        "processed_by": str(admin_id),
        "processed_at": datetime.now(timezone.utc),
    }
    if note is not None:
        update_doc["note"] = note
    if status is not None:
        update_doc["status"] = status

    updated = await get_payouts_collection().find_one_and_update(
        _id_query(payout_id),
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    return stringify_object_ids(updated) if updated else None


async def delete_payout(payout_id: str) -> bool:
    result = await get_payouts_collection().delete_one(_id_query(payout_id))
    return result.deleted_count == 1
