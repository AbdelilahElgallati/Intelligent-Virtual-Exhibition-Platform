import re

with open(r"backend\app\modules\marketplace\router.py", "r", encoding="utf-8") as f:
    content = f.read()

old_logic = """    order_ids: list[str] = []
    total_cart_amount = 0.0
    product_names: list[str] = []

    for cart_item in body.items:
        product = await mkt_svc.get_product(cart_item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")
        if product["stand_id"] != stand_id:
            raise HTTPException(status_code=400, detail=f"Product {cart_item.product_id} does not belong to this stand")
        if product["stock"] < cart_item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")

        total = round(product["price"] * cart_item.quantity, 2)

        if body.payment_method == "cash_on_delivery":
            await mkt_svc.decrement_stock(product["id"], cart_item.quantity)

        order = await mkt_svc.create_order(
            product_id=cart_item.product_id,
            stand_id=stand_id,
            buyer_id=str(user["_id"]),
            product_name=product["name"],
            quantity=cart_item.quantity,
            total_amount=total,
            payment_method=body.payment_method,
            shipping_address=body.shipping_address,
            delivery_notes=body.delivery_notes,
            buyer_phone=body.buyer_phone,
        )
        order_ids.append(order["id"])
        total_cart_amount += total
        product_names.append(product["name"])"""

new_logic = """    order_ids: list[str] = []
    total_cart_amount = 0.0
    product_names: list[str] = []
    stripe_items = []

    for cart_item in body.items:
        product = await mkt_svc.get_product(cart_item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")
        if product["stand_id"] != stand_id:
            raise HTTPException(status_code=400, detail=f"Product {cart_item.product_id} does not belong to this stand")
        if product["stock"] < cart_item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")

        total = round(product["price"] * cart_item.quantity, 2)

        if body.payment_method == "cash_on_delivery":
            await mkt_svc.decrement_stock(product["id"], cart_item.quantity)

        order = await mkt_svc.create_order(
            product_id=cart_item.product_id,
            stand_id=stand_id,
            buyer_id=str(user["_id"]),
            product_name=product["name"],
            quantity=cart_item.quantity,
            total_amount=total,
            payment_method=body.payment_method,
            shipping_address=body.shipping_address,
            delivery_notes=body.delivery_notes,
            buyer_phone=body.buyer_phone,
        )
        order_ids.append(order["id"])
        total_cart_amount += total
        product_names.append(product["name"])
        stripe_items.append({"name": product["name"], "amount": product["price"], "quantity": cart_item.quantity})"""

content = content.replace(old_logic, new_logic)

old_st = """    try:
        stripe_result = create_payment_session(
            order_id=",".join(order_ids),
            amount=total_cart_amount,
            product_name=f"Cart: {', '.join(product_names[:3])}{'...' if len(product_names) > 3 else ''}",
            buyer_email=user.get("email"),
            success_url=success_url,
            cancel_url=cancel_url,
        )"""

new_st = """    try:
        stripe_result = create_payment_session(
            order_id=",".join(order_ids),
            buyer_email=user.get("email"),
            success_url=success_url,
            cancel_url=cancel_url,
            items=stripe_items,
        )"""

content = content.replace(old_st, new_st)

with open(r"backend\app\modules\marketplace\router.py", "w", encoding="utf-8") as f:
    f.write(content)
