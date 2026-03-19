"""
Marketplace router — stand product/service CRUD, Stripe checkout, callback, orders, receipts.
Completely isolated from the existing event payment system.
"""

import logging
import math
import os
import shutil
import uuid

import stripe
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile, status

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.marketplace import service as mkt_svc
from app.modules.marketplace.schemas import (
    CartCheckoutRequest,
    CartCheckoutResponse,
    CheckoutRequest,
    CheckoutResponse,
    OrderFulfillmentUpdate,
    OrderOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.modules.marketplace.stripe_service import create_payment_session, construct_event

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
async def list_products(
    stand_id: str,
    type: str | None = Query(None, description="Filter by type: product or service"),
):
    """Public — list all products/services for a stand. Optionally filter by ?type=product or ?type=service."""
    stand = await _get_stand(stand_id)  # validates stand exists
    selected_links = stand.get("product_links") or []
    source_product_ids = [str(link.get("product_id")) for link in selected_links if isinstance(link, dict) and link.get("product_id")]
    products = await mkt_svc.list_products(
        stand_id,
        product_type=type,
        source_product_ids=source_product_ids or None,
    )
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


# ── Product Image Upload ────────────────────────────────────────────

PRODUCT_IMAGE_DIR = "uploads/product_images"
os.makedirs(PRODUCT_IMAGE_DIR, exist_ok=True)


@router.post("/upload-product-image")
async def upload_product_image(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a single product image and return its URL path."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(PRODUCT_IMAGE_DIR, safe_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"image_url": f"/uploads/product_images/{safe_name}"}


# ── Stripe & COD Checkout ────────────────────────────────────────────────

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
    Authenticated visitor — create a Stripe payment session or process COD for a single product/service.
    Returns the Stripe payment URL or successfully registers the order for COD.
    """
    stand = await _get_stand(stand_id)
    product = await mkt_svc.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product["stand_id"] != stand_id:
        raise HTTPException(status_code=400, detail="Product does not belong to this stand")
    is_service = str(product.get("type") or "product") == "service"
    effective_quantity = 1 if is_service else body.quantity

    if not is_service and product["stock"] < effective_quantity:
        raise HTTPException(status_code=400, detail="Not enough stock")

    total = round(product["price"] * effective_quantity, 2)

    if body.payment_method == "cash_on_delivery" and not is_service:
        # Deduct stock immediately since it's a confirmed order type
        await mkt_svc.decrement_stock(product["id"], effective_quantity)

    # Create order
    order = await mkt_svc.create_order(
        product_id=product_id,
        stand_id=stand_id,
        buyer_id=str(user["_id"]),
        product_name=product["name"],
        quantity=effective_quantity,
        total_amount=total,
        unit_price=float(product["price"]),
        currency=product.get("currency", "MAD"),
        payment_method=body.payment_method,
        shipping_address=body.shipping_address,
        delivery_notes=body.delivery_notes,
        buyer_phone=body.buyer_phone,
    )

    if body.payment_method == "cash_on_delivery":
        return CheckoutResponse(payment_url=None, order_id=order["id"])

    # Stripe URL building
    origin = request.headers.get("origin") or request.headers.get("referer") or settings.FRONTEND_URL
    origin = origin.rstrip("/")
    success_url = (
        f"{origin}/marketplace/success?session_id={{CHECKOUT_SESSION_ID}}"
        f"&stand_id={stand_id}&event_id={stand.get('event_id', '')}"
    )
    cancel_url = f"{origin}/marketplace/cancel?stand_id={stand_id}&event_id={stand.get('event_id', '')}"

    try:
        stripe_currency = 'mad'
        display_name = f"Purchase: {product['name']}" if is_service else f"Purchase: {product['name']} x{effective_quantity}"
        stripe_result = create_payment_session(
            order_id=order["id"],
            amount=total,
            product_name=display_name,
            buyer_email=user.get("email"),
            success_url=success_url,
            cancel_url=cancel_url,
            line_items=[{
                'name': product['name'],
                'description': (product.get('description') or '')[:200],
                'unit_amount': int(product['price'] * 100),
                'currency': stripe_currency,
                'quantity': effective_quantity,
            }],
        )
    except Exception as exc:
        logger.error("Stripe checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update order with stripe session id
    from bson import ObjectId

    await get_database().stand_orders.update_one(
        {"_id": ObjectId(order["id"])},
        {"$set": {"stripe_session_id": stripe_result["session_id"]}},
    )

    return CheckoutResponse(payment_url=stripe_result["url"], order_id=order["id"])


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
    Authenticated visitor — checkout multiple products/services from the same stand.
    Creates one Stripe payment session for the total cart amount or processes COD.
    """
    stand = await _get_stand(stand_id)  # validate stand exists

    order_ids: list[str] = []
    total_cart_amount = 0.0
    product_names: list[str] = []

    for cart_item in body.items:
        product = await mkt_svc.get_product(cart_item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")
        if product["stand_id"] != stand_id:
            raise HTTPException(status_code=400, detail=f"Product {cart_item.product_id} does not belong to this stand")
        is_service = str(product.get("type") or "product") == "service"
        effective_quantity = 1 if is_service else cart_item.quantity

        if not is_service and product["stock"] < effective_quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")

        total = round(product["price"] * effective_quantity, 2)
        
        if body.payment_method == "cash_on_delivery" and not is_service:
            await mkt_svc.decrement_stock(product["id"], effective_quantity)

        order = await mkt_svc.create_order(
            product_id=cart_item.product_id,
            stand_id=stand_id,
            buyer_id=str(user["_id"]),
            product_name=product["name"],
            quantity=effective_quantity,
            total_amount=total,
            unit_price=float(product["price"]),
            currency=product.get("currency", "MAD"),
            payment_method=body.payment_method,
            shipping_address=body.shipping_address,
            delivery_notes=body.delivery_notes,
            buyer_phone=body.buyer_phone,
        )
        order_ids.append(order["id"])
        total_cart_amount += total
        product_names.append(product["name"])

    if body.payment_method == "cash_on_delivery":
        return CartCheckoutResponse(payment_url=None, order_ids=order_ids)

    origin = request.headers.get("origin") or request.headers.get("referer") or settings.FRONTEND_URL
    origin = origin.rstrip("/")
    success_url = (
        f"{origin}/marketplace/success?session_id={{CHECKOUT_SESSION_ID}}"
        f"&stand_id={stand_id}&event_id={stand.get('event_id', '')}"
    )
    cancel_url = f"{origin}/marketplace/cancel?stand_id={stand_id}&event_id={stand.get('event_id', '')}"

    # Build detailed line items for Stripe
    cart_line_items = []
    for cart_item in body.items:
        product = await mkt_svc.get_product(cart_item.product_id)
        if product:
            product_is_service = str(product.get("type") or "product") == "service"
            cart_line_items.append({
                'name': product['name'],
                'description': (product.get('description') or '')[:200],
                'unit_amount': int(product['price'] * 100),
                'currency': 'mad',
                'quantity': 1 if product_is_service else cart_item.quantity,
            })

    try:
        stripe_result = create_payment_session(
            order_id=",".join(order_ids),
            amount=total_cart_amount,
            product_name=f"Cart: {', '.join(product_names[:3])}{'...' if len(product_names) > 3 else ''}",
            buyer_email=user.get("email"),
            success_url=success_url,
            cancel_url=cancel_url,
            line_items=cart_line_items if cart_line_items else None,
        )
    except Exception as exc:
        logger.error("Stripe cart checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update all orders with stripe session id
    try:
        from bson import ObjectId as _OID

        for oid in order_ids:
            await get_database().stand_orders.update_one(
                {"_id": _OID(oid)},
                {"$set": {"stripe_session_id": stripe_result["session_id"]}},
            )
    except Exception as exc:
        logger.error("Failed to update orders with session id: %s", exc)

    return CartCheckoutResponse(payment_url=stripe_result["url"], order_ids=order_ids)


# ── Stripe Webhook (server-to-server notification) ────────────────

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """
    Stripe sends payment notifications here.
    Verifies signature, handles completed payments.
    """
    payload = await request.body()
    try:
        event = construct_event(payload, stripe_signature)
    except stripe.error.SignatureVerificationError as e:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Payment is successful
        order_id_str = session.get('client_reference_id', '')
        payment_intent_id = session.get('payment_intent', '')

        ids_to_process = [oid.strip() for oid in order_id_str.split(",") if oid.strip()]
        for oid in ids_to_process:
            order, changed = await mkt_svc.mark_order_paid_if_pending(oid, payment_intent_id)
            if order and changed:
                product = await mkt_svc.get_product(order["product_id"])
                if product and str(product.get("type") or "product") != "service":
                    await mkt_svc.decrement_stock(order["product_id"], order["quantity"])
                logger.info("Order %s paid via Stripe intent %s", oid, payment_intent_id)

    return {"status": "success"}


# ── Orders ──────────────────────────────────────────────────────────

@router.get("/stands/{stand_id}/orders", response_model=list[OrderOut])
async def list_stand_orders(
    stand_id: str,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — list orders for this stand."""
    await _require_stand_owner(stand_id, user)
    return await mkt_svc.list_orders_for_stand(stand_id)


@router.get("/orders", response_model=list[OrderOut])
async def list_my_orders(
    user: dict = Depends(get_current_user),
):
    """Authenticated user — list their own marketplace orders."""
    return await mkt_svc.list_orders_for_buyer(str(user["_id"]))


@router.patch("/orders/{order_id}/fulfillment-status", response_model=OrderOut)
async def update_order_fulfillment_status(
    order_id: str,
    body: OrderFulfillmentUpdate,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — update fulfillment workflow status for one order."""
    order = await mkt_svc.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await _require_stand_owner(order["stand_id"], user)
    updated = await mkt_svc.update_order_fulfillment_status(order_id, body.fulfillment_status, body.note)
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
    return updated


@router.get("/orders/by-session", response_model=list[OrderOut])
async def list_orders_by_session(
    session_id: str = Query(..., description="Stripe session ID"),
    user: dict = Depends(get_current_user),
):
    """Return only orders that belong to a specific Stripe checkout session."""
    orders = await mkt_svc.list_orders_for_buyer(str(user["_id"]), session_id=session_id)

    # Webhook may be delayed in local/dev setups; perform a safe status sync from Stripe session.
    has_pending_stripe_orders = any(
        o.get("payment_method") == "stripe" and o.get("status") == "pending"
        for o in orders
    )
    if has_pending_stripe_orders:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            if session and session.payment_status == "paid":
                payment_intent_id = session.payment_intent or ""
                for order in orders:
                    if order.get("payment_method") == "stripe" and order.get("status") == "pending":
                        updated_order, changed = await mkt_svc.mark_order_paid_if_pending(order["id"], payment_intent_id)
                        if updated_order and changed:
                            product = await mkt_svc.get_product(updated_order["product_id"])
                            if product and str(product.get("type") or "product") != "service":
                                await mkt_svc.decrement_stock(updated_order["product_id"], updated_order["quantity"])

                # Return refreshed state after sync
                orders = await mkt_svc.list_orders_for_buyer(str(user["_id"]), session_id=session_id)
        except Exception as exc:
            logger.warning("Session status sync skipped for %s: %s", session_id, exc)

    return orders


@router.get("/orders/{order_id}/receipt")
async def get_order_receipt(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    """Generate a receipt for a marketplace order."""
    from bson import ObjectId

    db = get_database()
    oid = ObjectId(order_id) if ObjectId.is_valid(order_id) else order_id
    order = await db.stand_orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order = stringify_object_ids(order)
    if order.get("buyer_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Not your order")

    # Get product details
    product = None
    product_id = order.get("product_id")
    if product_id and ObjectId.is_valid(product_id):
        product = await db.stand_products.find_one({"_id": ObjectId(product_id)})
        if product:
            product = stringify_object_ids(product)

    # Resolve seller details (enterprise owning this stand)
    seller_name = ""
    seller_email = ""
    stand = None
    org = None
    stand_id = order.get("stand_id")
    if stand_id and ObjectId.is_valid(stand_id):
        stand = await db.stands.find_one({"_id": ObjectId(stand_id)})
    if stand and stand.get("organization_id"):
        org_id = str(stand.get("organization_id"))
        if ObjectId.is_valid(org_id):
            org = await db.organizations.find_one({"_id": ObjectId(org_id)})
        else:
            org = await db.organizations.find_one({"_id": org_id})
    if org:
        org = stringify_object_ids(org)
        seller_name = org.get("name", "")
        owner_id = str(org.get("owner_id", ""))
        if owner_id and ObjectId.is_valid(owner_id):
            seller_user = await db.users.find_one({"_id": ObjectId(owner_id)})
            if seller_user:
                seller_user = stringify_object_ids(seller_user)
                seller_email = seller_user.get("email", "")

    quantity = int(order.get("quantity", 1) or 1)
    total_amount = float(order.get("total_amount", 0) or 0)
    unit_price = float(order.get("unit_price", 0) or 0)
    product_type = product.get("type", "product") if product else "product"
    is_service = str(product_type) == "service"
    if unit_price <= 0 and quantity > 0 and total_amount > 0:
        unit_price = round(total_amount / quantity, 2)
    display_quantity = None if is_service else quantity
    display_unit_price = total_amount if is_service else unit_price

    receipt = {
        "receipt_id": order["_id"],
        "order_id": order["_id"],
        "product_name": product["name"] if product else order.get("product_name", "Unknown"),
        "product_type": product_type,
        "quantity": display_quantity,
        "unit_price": display_unit_price,
        "amount": total_amount,
        "currency": (order.get("currency") or (product.get("currency") if product else "MAD") or "MAD").upper(),
        "status": order.get("status", "unknown"),
        "payment_method": order.get("payment_method", "stripe"),
        "stripe_session_id": order.get("stripe_session_id", ""),
        "stripe_payment_intent_id": order.get("stripe_payment_intent_id", ""),
        "buyer_name": user.get("full_name", user.get("name", "")),
        "buyer_email": user.get("email", ""),
        "seller_name": seller_name,
        "seller_email": seller_email,
        "shipping_address": order.get("shipping_address", ""),
        "delivery_notes": order.get("delivery_notes", ""),
        "buyer_phone": order.get("buyer_phone", ""),
        "created_at": order["created_at"].isoformat() if hasattr(order.get("created_at", ""), "isoformat") else str(order.get("created_at", "")),
        "paid_at": order["paid_at"].isoformat() if order.get("paid_at") and hasattr(order["paid_at"], "isoformat") else str(order.get("paid_at", "")),
    }

    return receipt
