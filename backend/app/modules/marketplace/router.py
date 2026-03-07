"""
Marketplace router — stand product CRUD, Stripe checkout, webhook, orders.
Completely isolated from the existing event payment system.
"""

import logging
import math

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.dependencies import get_current_user
from app.db.mongo import get_database
from app.modules.marketplace import service as mkt_svc
from app.modules.marketplace.schemas import (
    CartCheckoutRequest,
    CartCheckoutResponse,
    CheckoutRequest,
    CheckoutResponse,
    OrderOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.modules.marketplace.stripe_service import (
    create_cart_checkout_session,
    create_checkout_session,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# ── Helpers ─────────────────────────────────────────────────────────

async def _get_stand(stand_id: str) -> dict:
    """Fetch a stand or 404."""
    from bson import ObjectId

    db = get_database()
    query = {"_id": ObjectId(stand_id)} if ObjectId.is_valid(stand_id) else {"_id": stand_id}
    stand = await db.stands.find_one(query)
    if not stand:
        raise HTTPException(status_code=404, detail="Stand not found")
    return stand


async def _require_stand_owner(stand_id: str, user: dict) -> dict:
    """Return the stand if the current user owns the organization or is admin."""
    stand = await _get_stand(stand_id)
    org_id = stand.get("organization_id")

    # Admin bypass
    if user.get("role") == "admin":
        return stand

    # Check organization ownership
    from bson import ObjectId

    db = get_database()
    org_query = {"_id": ObjectId(org_id)} if ObjectId.is_valid(str(org_id)) else {"_id": org_id}
    org = await db.organizations.find_one(org_query)
    if not org or str(org.get("owner_id")) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to manage this stand's products")
    return stand


# ── Products CRUD ───────────────────────────────────────────────────

@router.get("/stands/{stand_id}/products", response_model=list[ProductOut])
async def list_products(stand_id: str):
    """Public — list all products for a stand."""
    await _get_stand(stand_id)  # validates stand exists
    products = await mkt_svc.list_products(stand_id)
    return products


@router.post(
    "/stands/{stand_id}/products",
    response_model=ProductOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    stand_id: str,
    body: ProductCreate,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — create a product."""
    await _require_stand_owner(stand_id, user)
    product = await mkt_svc.create_product(stand_id, body.model_dump())
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    body: ProductUpdate,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — update a product."""
    product = await mkt_svc.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await _require_stand_owner(product["stand_id"], user)
    updated = await mkt_svc.update_product(product_id, body.model_dump(exclude_unset=True))
    return updated


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — delete a product."""
    product = await mkt_svc.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await _require_stand_owner(product["stand_id"], user)
    await mkt_svc.delete_product(product_id)
    return None


# ── Stripe Checkout ─────────────────────────────────────────────────

@router.post(
    "/stands/{stand_id}/products/{product_id}/checkout",
    response_model=CheckoutResponse,
)
async def checkout_product(
    stand_id: str,
    product_id: str,
    body: CheckoutRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Authenticated visitor — create a Stripe Checkout session.
    Returns the Stripe session URL to redirect the browser to.
    """
    product = await mkt_svc.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product["stand_id"] != stand_id:
        raise HTTPException(status_code=400, detail="Product does not belong to this stand")
    if product["stock"] < body.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock")

    total = round(product["price"] * body.quantity, 2)

    # Create pending order
    order = await mkt_svc.create_order(
        product_id=product_id,
        stand_id=stand_id,
        buyer_id=str(user["_id"]),
        product_name=product["name"],
        quantity=body.quantity,
        total_amount=total,
        stripe_session_id="",  # will be updated below
    )

    # Build success/cancel URLs (frontend pages)
    base = str(request.base_url).rstrip("/")
    success_url = f"{base.replace(str(request.url.port or ''), '3000').replace('http://localhost:8000', 'http://localhost:3000')}"
    # Use frontend origin from Referer / Origin header if available
    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    success_url = f"{origin}/marketplace/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/marketplace/cancel"

    unit_price_cents = int(math.ceil(product["price"] * 100))

    try:
        session = create_checkout_session(
            product_name=product["name"],
            unit_price_cents=unit_price_cents,
            currency=product.get("currency", "usd"),
            quantity=body.quantity,
            order_id=order["id"],
            success_url=success_url,
            cancel_url=cancel_url,
            buyer_email=user.get("email"),
        )
    except Exception as exc:
        logger.error("Stripe checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update order with stripe session id
    from app.db.mongo import get_database as _gdb
    from bson import ObjectId

    await _gdb().stand_orders.update_one(
        {"_id": ObjectId(order["id"])},
        {"$set": {"stripe_session_id": session.id}},
    )

    return CheckoutResponse(session_url=session.url, order_id=order["id"])


# ── Cart Checkout (multiple products) ───────────────────────────────

@router.post(
    "/stands/{stand_id}/cart/checkout",
    response_model=CartCheckoutResponse,
)
async def cart_checkout(
    stand_id: str,
    body: CartCheckoutRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Authenticated visitor — checkout multiple products from the same stand at once.
    Creates one Stripe Checkout Session with multiple line items.
    """
    await _get_stand(stand_id)  # validate stand exists

    # Resolve and validate all items
    stripe_items: list[dict] = []
    order_ids: list[str] = []

    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    success_url = f"{origin}/marketplace/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/marketplace/cancel"

    for cart_item in body.items:
        product = await mkt_svc.get_product(cart_item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")
        if product["stand_id"] != stand_id:
            raise HTTPException(status_code=400, detail=f"Product {cart_item.product_id} does not belong to this stand")
        if product["stock"] < cart_item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")

        total = round(product["price"] * cart_item.quantity, 2)
        order = await mkt_svc.create_order(
            product_id=cart_item.product_id,
            stand_id=stand_id,
            buyer_id=str(user["_id"]),
            product_name=product["name"],
            quantity=cart_item.quantity,
            total_amount=total,
            stripe_session_id="",
        )
        order_ids.append(order["id"])
        stripe_items.append({
            "product_name": product["name"],
            "unit_price_cents": int(math.ceil(product["price"] * 100)),
            "currency": product.get("currency", "usd"),
            "quantity": cart_item.quantity,
        })

    try:
        session = create_cart_checkout_session(
            items=stripe_items,
            order_ids=order_ids,
            success_url=success_url,
            cancel_url=cancel_url,
            buyer_email=user.get("email"),
        )
    except Exception as exc:
        logger.error("Stripe cart checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update all orders with stripe session id
    try:
        from app.db.mongo import get_database as _gdb
        from bson import ObjectId as _OID

        for oid in order_ids:
            await _gdb().stand_orders.update_one(
                {"_id": _OID(oid)},
                {"$set": {"stripe_session_id": session.id}},
            )
    except Exception as exc:
        logger.error("Failed to update orders with session id: %s", exc)
        # Orders created but session link may be incomplete — still return the URL
        # so the visitor can complete payment

    return CartCheckoutResponse(session_url=session.url, order_ids=order_ids)


# ── Stripe Webhook ──────────────────────────────────────────────────

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """
    Stripe sends events here. Verifies signature, handles checkout.session.completed.
    No auth — Stripe signs the payload.
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = verify_webhook_signature(payload, sig)
    except Exception as exc:
        logger.warning("Stripe webhook signature failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.get("type", "") if isinstance(event, dict) else event.type

    if event_type == "checkout.session.completed":
        session_data = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        session_id = session_data.get("id") if isinstance(session_data, dict) else session_data.id
        payment_intent = (
            session_data.get("payment_intent") if isinstance(session_data, dict) else session_data.payment_intent
        )
        metadata = session_data.get("metadata", {}) if isinstance(session_data, dict) else session_data.metadata

        # Cart checkout stores comma-separated order_ids
        order_ids_str = metadata.get("order_ids", "")
        single_order_id = metadata.get("order_id", "")

        ids_to_process = []
        if order_ids_str:
            ids_to_process = [oid.strip() for oid in order_ids_str.split(",") if oid.strip()]
        elif single_order_id:
            ids_to_process = [single_order_id]

        for oid in ids_to_process:
            order = await mkt_svc.mark_order_paid(oid, payment_intent or "")
            if order:
                await mkt_svc.decrement_stock(order["product_id"], order["quantity"])
                logger.info("Order %s paid via Stripe session %s", oid, session_id)

        if not ids_to_process:
            # Fallback: try to find order by session id
            order = await mkt_svc.get_order_by_stripe_session(session_id)
            if order and order["status"] != "paid":
                await mkt_svc.mark_order_paid(order["id"], payment_intent or "")
                await mkt_svc.decrement_stock(order["product_id"], order["quantity"])

    return {"status": "ok"}


# ── Orders ──────────────────────────────────────────────────────────

@router.get("/stands/{stand_id}/orders", response_model=list[OrderOut])
async def list_stand_orders(
    stand_id: str,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — list orders for this stand."""
    await _require_stand_owner(stand_id, user)
    return await mkt_svc.list_orders_for_stand(stand_id)


@router.get("/my-orders", response_model=list[OrderOut])
async def list_my_orders(
    user: dict = Depends(get_current_user),
):
    """Authenticated user — list their own marketplace orders."""
    return await mkt_svc.list_orders_for_buyer(str(user["_id"]))
