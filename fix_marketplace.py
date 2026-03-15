import re

with open(r"backend\app\modules\marketplace\service.py", "r", encoding="utf-8") as f:
    content = f.read()

bad_func = """async def mark_order_paid(order_id: str, payment_intent_id: str = "") -> Optional[dict]:
    await _db().stand_orders.update_one(
        {"_id": _oid(order_id)},
        {
            "$set": {
                "status": "paid",
                "stripe_payment_intent_id": payment_intent_id,"""

good_func = """async def mark_order_paid(order_id: str, payment_intent_id: str = "") -> Optional[dict]:
    await _db().stand_orders.update_one(
        {"_id": _oid(order_id)},
        {"$set": {
            "status": "paid",
            "stripe_payment_intent_id": payment_intent_id,
        }}
    )
    doc = await _db().stand_orders.find_one({"_id": _oid(order_id)})
    return _serialize(doc) if doc else None"""

# Use replace, not regex, because we want an exact match
content = content.replace(bad_func, good_func)

with open(r"backend\app\modules\marketplace\service.py", "w", encoding="utf-8") as f:
    f.write(content)
