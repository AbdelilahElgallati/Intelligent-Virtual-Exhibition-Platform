import re

with open(r"backend\app\modules\marketplace\router.py", "r", encoding="utf-8") as f:
    content = f.read()

old_logic = """@router.get("/orders", response_model=list[OrderOut])
async def list_my_orders(
    user: dict = Depends(get_current_user),
):
    \"\"\"Authenticated user â” list their own marketplace orders.\"\"\"
    return await mkt_svc.list_orders_for_buyer(str(user["_id"]))"""

# Let's use regex because of the weird character issue in comments
content = re.sub(
    r'@router\.get\("/orders", response_model=list\[OrderOut\]\)\nasync def list_my_orders\(\n    user: dict = Depends\(get_current_user\),\n\):\n    .*?return await mkt_svc\.list_orders_for_buyer\(str\(user\["_id"\]\)\)',
    '@router.get("/orders", response_model=list[OrderOut])\nasync def list_my_orders(\n    session_id: str | None = Query(None),\n    user: dict = Depends(get_current_user),\n):\n    """Authenticated user list their own marketplace orders."""\n    return await mkt_svc.list_orders_for_buyer(str(user["_id"]), session_id=session_id)',
    content,
    flags=re.DOTALL
)

with open(r"backend\app\modules\marketplace\router.py", "w", encoding="utf-8") as f:
    f.write(content)
