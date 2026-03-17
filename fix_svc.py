import re

with open(r"backend\app\modules\marketplace\service.py", "r", encoding="utf-8") as f:
    content = f.read()

old_logic = """async def list_orders_for_buyer(buyer_id: str) -> list[dict]:
    cursor = _db().stand_orders.find({"buyer_id": _oid(buyer_id)}).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]"""

new_logic = """async def list_orders_for_buyer(buyer_id: str, session_id: str = None) -> list[dict]:
    query = {"buyer_id": _oid(buyer_id)}
    if session_id:
        query["stripe_session_id"] = session_id
    cursor = _db().stand_orders.find(query).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]"""

content = content.replace(old_logic, new_logic)

with open(r"backend\app\modules\marketplace\service.py", "w", encoding="utf-8") as f:
    f.write(content)
