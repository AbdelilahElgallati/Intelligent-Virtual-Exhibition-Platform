"""
Marketplace router — stand product/service CRUD, Payzone checkout, callback, orders, receipts.
Completely isolated from the existing event payment system.
"""

import logging
import math
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

from app.core.dependencies import get_current_user
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
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
from app.modules.marketplace.payzone_service import (
    create_payment_session,
    verify_callback_signature,
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
async def list_products(
    stand_id: str,
    type: str | None = Query(None, description="Filter by type: product or service"),
):
    """Public — list all products/services for a stand. Optionally filter by ?type=product or ?type=service."""
    await _get_stand(stand_id)  # validates stand exists
    products = await mkt_svc.list_products(stand_id, product_type=type)
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


# ── Payzone Checkout ────────────────────────────────────────────────

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
    Authenticated visitor — create a Payzone payment session for a single product/service.
    Returns the Payzone payment URL to redirect the browser to.
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
        shipping_address=body.shipping_address,
        delivery_notes=body.delivery_notes,
        buyer_phone=body.buyer_phone,
    )

    # Build URLs
    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    backend_base = str(request.base_url).rstrip("/")
    success_url = f"{origin}/marketplace/success?payment_id={{PAYMENT_ID}}"
    cancel_url = f"{origin}/marketplace/cancel"
    notification_url = f"{backend_base}/marketplace/callback/payzone"

    amount_cents = int(math.ceil(total * 100))

    try:
        pz_result = await create_payment_session(
            order_id=order["id"],
            amount_cents=amount_cents,
            currency=product.get("currency", "MAD"),
            description=f"Purchase: {product['name']} x{body.quantity}",
            success_url=success_url,
            cancel_url=cancel_url,
            notification_url=notification_url,
            customer_email=user.get("email"),
            customer_name=user.get("full_name", user.get("name", "")),
            metadata={"order_id": order["id"], "stand_id": stand_id},
        )
    except Exception as exc:
        logger.error("Payzone checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update order with payzone payment id
    from bson import ObjectId

    await get_database().stand_orders.update_one(
        {"_id": ObjectId(order["id"])},
        {"$set": {"payzone_payment_id": pz_result["payment_id"]}},
    )

    return CheckoutResponse(payment_url=pz_result["payment_url"], order_id=order["id"])


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
    Creates one Payzone payment session for the total cart amount.
    """
    await _get_stand(stand_id)  # validate stand exists

    order_ids: list[str] = []
    total_cart_amount = 0.0
    product_names: list[str] = []

    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    backend_base = str(request.base_url).rstrip("/")
    success_url = f"{origin}/marketplace/success?payment_id={{PAYMENT_ID}}"
    cancel_url = f"{origin}/marketplace/cancel"
    notification_url = f"{backend_base}/marketplace/callback/payzone"

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
            shipping_address=body.shipping_address,
            delivery_notes=body.delivery_notes,
            buyer_phone=body.buyer_phone,
        )
        order_ids.append(order["id"])
        total_cart_amount += total
        product_names.append(product["name"])

    amount_cents = int(math.ceil(total_cart_amount * 100))

    try:
        pz_result = await create_payment_session(
            order_id=",".join(order_ids),
            amount_cents=amount_cents,
            currency="MAD",
            description=f"Cart: {', '.join(product_names[:3])}{'...' if len(product_names) > 3 else ''}",
            success_url=success_url,
            cancel_url=cancel_url,
            notification_url=notification_url,
            customer_email=user.get("email"),
            customer_name=user.get("full_name", user.get("name", "")),
            metadata={"order_ids": ",".join(order_ids), "stand_id": stand_id},
        )
    except Exception as exc:
        logger.error("Payzone cart checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update all orders with payzone payment id
    try:
        from bson import ObjectId as _OID

        for oid in order_ids:
            await get_database().stand_orders.update_one(
                {"_id": _OID(oid)},
                {"$set": {"payzone_payment_id": pz_result["payment_id"]}},
            )
    except Exception as exc:
        logger.error("Failed to update orders with payment id: %s", exc)

    return CartCheckoutResponse(payment_url=pz_result["payment_url"], order_ids=order_ids)


# ── Payzone Callback (server-to-server notification) ────────────────

@router.post("/callback/payzone")
async def payzone_callback(request: Request):
    """
    Payzone sends payment notifications here.
    Verifies signature, handles completed payments.
    No auth — Payzone signs the payload.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Verify signature
    received_sig = body.get("signature", "")
    if not verify_callback_signature(body, received_sig):
        logger.warning("Payzone callback signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")

    payment_status = body.get("status", "")
    payment_id = body.get("payment_id", "")
    transaction_id = body.get("transaction_id", "")
    order_id_str = body.get("order_id", "")

    if payment_status == "completed":
        # Handle single or multiple order IDs (comma-separated)
        ids_to_process = [oid.strip() for oid in order_id_str.split(",") if oid.strip()]

        for oid in ids_to_process:
            order = await mkt_svc.mark_order_paid(oid, transaction_id)
            if order:
                await mkt_svc.decrement_stock(order["product_id"], order["quantity"])
                logger.info("Order %s paid via Payzone payment %s", oid, payment_id)

        if not ids_to_process and payment_id:
            # Fallback: find order by payzone payment id
            order = await mkt_svc.get_order_by_payzone_payment(payment_id)
            if order and order["status"] != "paid":
                await mkt_svc.mark_order_paid(order["id"], transaction_id)
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


@router.get("/orders", response_model=list[OrderOut])
async def list_my_orders(
    user: dict = Depends(get_current_user),
):
    """Authenticated user — list their own marketplace orders."""
    return await mkt_svc.list_orders_for_buyer(str(user["_id"]))


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

    receipt = {
        "receipt_id": order["_id"],
        "order_id": order["_id"],
        "product_name": product["name"] if product else order.get("product_name", "Unknown"),
        "product_type": product.get("type", "product") if product else "product",
        "quantity": order.get("quantity", 1),
        "amount": order.get("total_price", order.get("price", 0)),
        "currency": order.get("currency", "MAD").upper(),
        "status": order.get("status", "unknown"),
        "payment_method": "Payzone",
        "payzone_payment_id": order.get("payzone_payment_id", ""),
        "payzone_transaction_id": order.get("payzone_transaction_id", ""),
        "buyer_name": user.get("full_name", user.get("name", "")),
        "buyer_email": user.get("email", ""),
        "shipping_address": order.get("shipping_address", ""),
        "delivery_notes": order.get("delivery_notes", ""),
        "created_at": order["created_at"].isoformat() if hasattr(order.get("created_at", ""), "isoformat") else str(order.get("created_at", "")),
        "paid_at": order["paid_at"].isoformat() if order.get("paid_at") and hasattr(order["paid_at"], "isoformat") else str(order.get("paid_at", "")),
    }

    return receipt
