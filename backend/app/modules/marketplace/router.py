"""
Marketplace router — stand product/service CRUD, Stripe checkout, orders, receipts.
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
    UnifiedOrderOut,
    OrderFulfillmentUpdate,
    OrderCancelRequest,
)
from app.modules.marketplace.stripe_service import create_payment_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# ── Helpers ──────────────────────────────────────────────────────────

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


# ── Products CRUD ─────────────────────────────────────────────────────

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
    await _require_stand_owner(str(product["stand_id"]), user)
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
    await _require_stand_owner(str(product["stand_id"]), user)
    await mkt_svc.delete_product(product_id)
    return None


# ── Product Image Upload ──────────────────────────────────────────────

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


# ── Checkout ─────────────────────────────────────────────────────────

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
    Authenticated visitor — checkout a single product/service.
    Supports 'stripe' (returns URL) or 'cash_on_delivery' (returns order_id).
    """
    product = await mkt_svc.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if str(product["stand_id"]) != stand_id:
        raise HTTPException(status_code=400, detail="Product does not belong to this stand")
    
    if str(product.get("type") or "product") != "service" and product["stock"] < body.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock")

    total = round(product["price"] * body.quantity, 2)

    # Create pending order
    order = await mkt_svc.create_order(
        product_id=product_id,
        stand_id=stand_id,
        buyer_id=str(user["_id"]),
        product_name=product["name"],
        quantity=body.quantity,
        unit_price=product["price"],
        total_amount=total,
        currency=product.get("currency", "MAD"),
        payment_method=body.payment_method,
        shipping_address=body.shipping_address,
        delivery_notes=body.delivery_notes,
        buyer_phone=body.buyer_phone,
    )

    if body.payment_method == "cash_on_delivery":
        # For COD, we don't return a payment URL.
        # Note: stock is only decremented upon payment confirmation in our model,
        # but for COD the stand owner might manage it manually or we'd need another flow.
        return CheckoutResponse(order_id=order["id"])

    # Stripe checkout logic
    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    success_url = f"{origin}/marketplace/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/marketplace/cancel"

    try:
        st_result = create_payment_session(
            order_id=order["id"],
            amount=total,
            product_name=product["name"],
            buyer_email=user.get("email", ""),
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"order_id": order["id"], "stand_id": stand_id, "source": "marketplace"},
            line_items=[{
                "name": f"{product['name']} x{body.quantity}",
                "unit_amount": int(math.ceil(product["price"] * 100)),
                "currency": product.get("currency", "MAD").lower(),
                "quantity": body.quantity,
            }]
        )
    except Exception as exc:
        logger.error("Stripe checkout failed: %s", exc)
        # Should we delete the pending order?
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update order with stripe session id
    from bson import ObjectId
    await get_database().stand_orders.update_one(
        {"_id": ObjectId(order["id"])},
        {"$set": {"stripe_session_id": st_result["session_id"]}},
    )

    return CheckoutResponse(payment_url=st_result["url"], order_id=order["id"])


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
    """
    await _get_stand(stand_id)  # validate stand exists

    checkout_group_id = uuid.uuid4().hex
    order_ids: list[str] = []
    total_cart_amount = 0.0
    line_items = []

    for cart_item in body.items:
        product = await mkt_svc.get_product(cart_item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")
        if str(product["stand_id"]) != stand_id:
            raise HTTPException(status_code=400, detail=f"Product {cart_item.product_id} does not belong to this stand")
        
        if str(product.get("type") or "product") != "service" and product["stock"] < cart_item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")

        item_total = round(product["price"] * cart_item.quantity, 2)
        order = await mkt_svc.create_order(
            product_id=cart_item.product_id,
            stand_id=stand_id,
            buyer_id=str(user["_id"]),
            product_name=product["name"],
            quantity=cart_item.quantity,
            unit_price=product["price"],
            total_amount=item_total,
            currency=product.get("currency", "MAD"),
            payment_method=body.payment_method,
            checkout_group_id=checkout_group_id,
            shipping_address=body.shipping_address,
            delivery_notes=body.delivery_notes,
            buyer_phone=body.buyer_phone,
        )
        order_ids.append(order["id"])
        total_cart_amount += item_total
        line_items.append({
            "name": f"{product['name']} x{cart_item.quantity}",
            "unit_amount": int(math.ceil(product["price"] * 100)),
            "currency": product.get("currency", "MAD").lower(),
            "quantity": cart_item.quantity,
        })

    if body.payment_method == "cash_on_delivery":
        return CartCheckoutResponse(order_ids=order_ids, checkout_group_id=checkout_group_id)

    # Stripe checkout logic
    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    success_url = f"{origin}/marketplace/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/marketplace/cancel"

    try:
        st_result = create_payment_session(
            order_id=",".join(order_ids),
            amount=total_cart_amount,
            product_name=f"Cart checkout ({len(order_ids)} items)",
            buyer_email=user.get("email", ""),
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "order_id": ",".join(order_ids),
                "stand_id": stand_id,
                "source": "marketplace",
                "checkout_group_id": checkout_group_id
            },
            line_items=line_items
        )
    except Exception as exc:
        logger.error("Stripe cart checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Update all orders with stripe session id
    from bson import ObjectId
    await get_database().stand_orders.update_many(
        {"_id": {"$in": [ObjectId(oid) for oid in order_ids]}},
        {"$set": {"stripe_session_id": st_result["session_id"]}}
    )

    return CartCheckoutResponse(
        payment_url=st_result["url"], 
        order_ids=order_ids, 
        checkout_group_id=checkout_group_id
    )


# ── Orders ────────────────────────────────────────────────────────────

@router.get("/stands/{stand_id}/orders", response_model=list[OrderOut])
async def list_stand_orders(
    stand_id: str,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — list orders for this stand."""
    await _require_stand_owner(stand_id, user)
    return await mkt_svc.list_orders_for_stand(stand_id)


@router.get("/orders", response_model=list[UnifiedOrderOut])
async def list_my_unified_orders(
    session_id: str | None = Query(None),
    group_id: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    """Authenticated user — list their own marketplace orders, grouped by checkout."""
    return await mkt_svc.list_unified_orders_for_buyer(str(user["_id"]), session_id=session_id, group_id=group_id)


@router.patch("/orders/{order_id}/fulfillment", response_model=OrderOut)
async def update_order_fulfillment(
    order_id: str,
    body: OrderFulfillmentUpdate,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — update fulfillment status (processing, shipped, etc)."""
    order = await mkt_svc.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await _require_stand_owner(str(order["stand_id"]), user)
    
    updated = await mkt_svc.update_order_fulfillment_status(
        order_id, 
        body.fulfillment_status, 
        body.note
    )
    return updated


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
async def cancel_marketplace_order(
    order_id: str,
    body: OrderCancelRequest,
    user: dict = Depends(get_current_user),
):
    """Stand owner / admin — cancel an order (e.g. out of stock). Restores stock if it was paid."""
    order = await mkt_svc.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await _require_stand_owner(str(order["stand_id"]), user)
    
    cancelled = await mkt_svc.cancel_order(order_id, body.note)
    return cancelled


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

    if str(order.get("buyer_id")) != str(user["_id"]):
        # Also allow stand owner to see it? Maybe not for "my-receipt" style
        raise HTTPException(status_code=403, detail="Not your order")

    # Get product details
    product = await db.stand_products.find_one({"_id": order.get("product_id")})

    receipt = {
        "receipt_id": str(order["_id"]),
        "order_id": str(order["_id"]),
        "product_name": product["name"] if product else order.get("product_name", "Unknown"),
        "product_type": product.get("type", "product") if product else "product",
        "quantity": order.get("quantity", 1),
        "amount": order.get("total_amount", 0),
        "currency": order.get("currency", "MAD").upper(),
        "status": order.get("status", "unknown"),
        "payment_method": order.get("payment_method", "stripe"),
        "stripe_session_id": order.get("stripe_session_id", ""),
        "stripe_payment_intent_id": order.get("stripe_payment_intent_id", ""),
        "buyer_name": user.get("full_name", user.get("name", "")),
        "buyer_email": user.get("email", ""),
        "shipping_address": order.get("shipping_address", ""),
        "delivery_notes": order.get("delivery_notes", ""),
        "created_at": order["created_at"].isoformat() if hasattr(order.get("created_at", ""), "isoformat") else str(order.get("created_at", "")),
        "paid_at": order["paid_at"].isoformat() if order.get("paid_at") and hasattr(order["paid_at"], "isoformat") else str(order.get("paid_at", "")),
    }

    return receipt
