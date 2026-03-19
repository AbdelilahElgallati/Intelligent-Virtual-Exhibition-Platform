from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from typing import Any, List, Optional
from datetime import datetime, timezone
import uuid
import os
import shutil
from urllib.parse import urlparse, parse_qs

from app.core.dependencies import require_role
from app.modules.auth.enums import Role
from app.modules.organizations.service import get_organizations_collection, create_organization
from app.modules.organizations.schemas import OrganizationCreate
from app.modules.enterprise.schemas import (
    EnterpriseProfileUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProductRequestStatusUpdate,
    ProductRequestRead,
    ProductRequestCreate,
    ProductStatus,
)
from app.modules.enterprise.repository import enterprise_repo
from app.modules.leads.service import lead_service
from app.modules.leads.schemas import LeadInteraction
from app.modules.participants.schemas import ParticipantStatus
from app.modules.events.service import get_event_by_id
from app.modules.stands.service import get_stand_by_org, update_stand, create_stand
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from bson import ObjectId

router = APIRouter(prefix="/enterprise", tags=["Enterprise"])

PRODUCT_IMAGE_DIR = "uploads/product_images"
PROFILE_IMAGE_DIR = "uploads/enterprise_profile"
os.makedirs(PRODUCT_IMAGE_DIR, exist_ok=True)
os.makedirs(PROFILE_IMAGE_DIR, exist_ok=True)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def upload_profile_image(org_id: str, file: UploadFile, field_name: str) -> str:
    """Helper to save a profile image (logo or banner) and return its URL."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    safe_name = f"{org_id}_{field_name}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(PROFILE_IMAGE_DIR, safe_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return f"/uploads/enterprise_profile/{safe_name}"

async def get_enterprise_org(current_user: dict) -> dict:
    """Find enterprise organization; auto-provision one if missing."""
    db = get_database()
    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enterprise organization not found")

    # Owner lookup (primary path).
    org_doc = await db.organizations.find_one({"owner_id": user_id})

    # Some legacy documents may use a different owner key.
    if not org_doc:
        org_doc = await db.organizations.find_one({"created_by": user_id})

    # Member lookup fallback: enterprise user is linked via organization_members.
    if not org_doc:
        member_doc = await db.organization_members.find_one({"user_id": user_id})
        if member_doc:
            org_ref = str(member_doc.get("organization_id") or "")
            if org_ref:
                if ObjectId.is_valid(org_ref):
                    org_doc = await db.organizations.find_one({"_id": ObjectId(org_ref)})
                else:
                    org_doc = await db.organizations.find_one({"_id": org_ref})

    if org_doc:
        return stringify_object_ids(org_doc)

    # Auto-provision a minimal organization for enterprise accounts missing profile linkage.
    base_name = (
        (current_user.get("professional_info") or {}).get("company")
        or current_user.get("company")
        or current_user.get("org_name")
        or current_user.get("full_name")
        or current_user.get("email")
        or "Enterprise"
    )
    org_name = f"{str(base_name).strip()} Organization"

    # Ensure unique org name.
    name_in_use = await db.organizations.find_one({"name": org_name})
    if name_in_use:
        org_name = f"{org_name} {uuid.uuid4().hex[:6]}"

    try:
        created = await create_organization(
            OrganizationCreate(
                name=org_name,
                description="Auto-created enterprise organization profile",
            ),
            owner_id=user_id,
        )
        return created
    except Exception:
        pass

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enterprise organization not found")


async def get_enterprise_participant(event_id: str, org_id: str) -> Optional[dict]:
    """Get participant record for an enterprise org in an event."""
    db = get_database()
    doc = await db.participants.find_one({
        "event_id": str(event_id),
        "organization_id": str(org_id),
        "role": Role.ENTERPRISE.value,
    })
    return stringify_object_ids(doc) if doc else None


def _is_accepted_participant_status(status_value: Optional[str]) -> bool:
    return status_value in (ParticipantStatus.APPROVED.value, ParticipantStatus.GUEST_APPROVED.value)


def _event_token_is_valid(event: dict, token: str, kind: str) -> bool:
    token_field = f"{kind}_invite_token"
    stored = event.get(token_field)
    if stored and token == stored:
        return True

    # Backward compatibility with old links where token lived in the URL query.
    link = event.get(f"{kind}_link")
    if not link:
        return False
    parsed = urlparse(link)
    legacy_token = parse_qs(parsed.query).get("token", [None])[0]
    return bool(legacy_token and token == legacy_token)


async def get_approved_stand(event_id: str, org_id: str, current_user: dict) -> dict:
    """Guard helper — returns stand only if enterprise is APPROVED for the event."""
    participant = await get_enterprise_participant(event_id, org_id)
    if not participant or not _is_accepted_participant_status(participant.get("status")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enterprise not approved for this event",
        )
    stand = await get_stand_by_org(event_id, org_id)
    if not stand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")
    return stand


async def ensure_enterprise_stand(event_id: str, org_id: str, org_hint: Optional[dict] = None) -> dict:
    """Ensure an enterprise stand exists once participation becomes APPROVED."""
    stand = await get_stand_by_org(event_id, org_id)
    if stand:
        return stand

    org_doc = org_hint
    if not org_doc:
        db = get_database()
        org_doc = await db.organizations.find_one({"_id": ObjectId(org_id)}) if ObjectId.is_valid(org_id) else None
        if not org_doc:
            org_doc = await db.organizations.find_one({"_id": org_id})
        if org_doc:
            org_doc = stringify_object_ids(org_doc)

    stand_name = (org_doc or {}).get("name") or "Enterprise Stand"
    stand_description = (org_doc or {}).get("description")
    return await create_stand(
        event_id=event_id,
        organization_id=org_id,
        name=stand_name,
        description=stand_description,
    )


# ─── Week 1: Profile, Products, Product Requests ─────────────────────────────

@router.get("/profile")
async def get_enterprise_profile(
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Get enterprise organization profile."""
    return await get_enterprise_org(current_user)


@router.patch("/profile")
async def update_enterprise_profile(
    data: EnterpriseProfileUpdate,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Update enterprise organization profile."""
    org = await get_enterprise_org(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        return org
    org_coll = get_organizations_collection()
    from pymongo import ReturnDocument
    updated_org = await org_coll.find_one_and_update(
        {"_id": ObjectId(org["id"])},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    return stringify_object_ids(updated_org)


@router.post("/profile/logo")
async def upload_enterprise_logo(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Upload enterprise logo."""
    org = await get_enterprise_org(current_user)
    image_url = await upload_profile_image(org["id"], file, "logo")
    
    org_coll = get_organizations_collection()
    await org_coll.update_one(
        {"_id": ObjectId(org["id"])},
        {"$set": {"logo_url": image_url}}
    )
    return {"logo_url": image_url}


@router.post("/profile/banner")
async def upload_enterprise_banner(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Upload enterprise banner."""
    org = await get_enterprise_org(current_user)
    image_url = await upload_profile_image(org["id"], file, "banner")
    
    org_coll = get_organizations_collection()
    await org_coll.update_one(
        {"_id": ObjectId(org["id"])},
        {"$set": {"banner_url": image_url}}
    )
    return {"banner_url": image_url}


@router.post("/products", response_model=ProductRead)
async def create_product(data: ProductCreate, current_user: dict = Depends(require_role(Role.ENTERPRISE))):
    org = await get_enterprise_org(current_user)
    return await enterprise_repo.create_product(str(current_user["_id"]), org["id"], data)


@router.get("/products")
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    products, total = await enterprise_repo.get_products(str(current_user["_id"]), skip, limit)
    return {"products": products, "total": total, "skip": skip, "limit": limit}


@router.patch("/products/{product_id}", response_model=ProductRead)
async def update_product(product_id: str, data: ProductUpdate, current_user: dict = Depends(require_role(Role.ENTERPRISE))):
    updated = await enterprise_repo.update_product(product_id, str(current_user["_id"]), data)
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    return updated


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(require_role(Role.ENTERPRISE))):
    success = await enterprise_repo.delete_product(product_id, str(current_user["_id"]))
    if not success:
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    return {"message": "Product soft-deleted successfully"}


@router.post("/products/{product_id}/image")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Upload a single image for a product and set its image_url field."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    safe_name = f"{product_id}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(PRODUCT_IMAGE_DIR, safe_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    image_url = f"/uploads/product_images/{safe_name}"

    updated = await enterprise_repo.set_product_image(product_id, str(current_user["_id"]), image_url)
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    return {"image_url": image_url}


@router.get("/product-requests", response_model=List[ProductRequestRead])
async def list_product_requests(current_user: dict = Depends(require_role(Role.ENTERPRISE))):
    return await enterprise_repo.get_enterprise_requests(str(current_user["_id"]))


@router.patch("/product-requests/{request_id}/status", response_model=ProductRequestRead)
async def update_request_status(request_id: str, data: ProductRequestStatusUpdate, current_user: dict = Depends(require_role(Role.ENTERPRISE))):
    updated = await enterprise_repo.update_request_status(request_id, str(current_user["_id"]), data.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Request not found or access denied")
    return updated


@router.post("/public/products/{product_id}/request")
async def visitor_request_product(
    product_id: str,
    data: ProductRequestCreate,
    current_user: dict = Depends(require_role(Role.VISITOR)),
):
    product = await enterprise_repo.get_product_by_id(product_id)
    if not product or not product.get("is_active"):
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate quantity: only meaningful for products (not services)
    quantity = None
    if product.get("type", "product") != "service" and data.quantity is not None and data.quantity > 0:
        quantity = data.quantity

    request = await enterprise_repo.create_product_request(
        visitor_id=str(current_user["_id"]),
        enterprise_id=product["enterprise_id"],
        product_id=product_id,
        event_id=data.event_id,
        message=data.message,
        quantity=quantity,
    )
    try:
        # Find the correct stand ID for this organization in this event
        stand_doc = await get_stand_by_org(data.event_id, product["organization_id"])
        actual_stand_id = stand_doc["id"] if stand_doc else f"org_{product['organization_id']}"
        
        await lead_service.log_interaction(LeadInteraction(
            visitor_id=str(current_user["_id"]),
            stand_id=actual_stand_id,
            interaction_type="product_request",
            metadata={
                "product_id": product_id,
                "request_id": request["id"],
                "event_id": data.event_id,
                "quantity": quantity,
            },
        ))
    except Exception:
        pass
    return request


# ─── Week 2: Event Join & Stand Flow ─────────────────────────────────────────

@router.get("/events")
async def list_enterprise_events(current_user: dict = Depends(require_role(Role.ENTERPRISE))):
    """List all events: available ones + enterprise's joined status + stands_left."""
    db = get_database()

    # Some enterprise accounts may exist before an organization profile is created.
    # In that case, still return the available event catalog with null participation.
    org = None
    try:
        org = await get_enterprise_org(current_user)
    except HTTPException as exc:
        if not (exc.status_code == status.HTTP_404_NOT_FOUND and str(exc.detail) == "Enterprise organization not found"):
            raise

    cursor = db.events.find({"state": {"$in": ["approved", "live", "waiting_for_payment", "payment_done"]}})
    all_events = stringify_object_ids(await cursor.to_list(length=200))

    participations = {}
    if org:
        part_cursor = db.participants.find({"organization_id": str(org["id"]), "role": Role.ENTERPRISE.value})
        participations = {p["event_id"]: p for p in stringify_object_ids(await part_cursor.to_list(length=200))}

    result = []
    for ev in all_events:
        ev_id = str(ev.get("id") or ev.get("_id"))
        # Calculate stands left: num_enterprises minus non-rejected enterprise participants
        num_ent = ev.get("num_enterprises") or 0
        taken = await db.participants.count_documents({
            "event_id": ev_id,
            "role": Role.ENTERPRISE.value,
            "status": {"$nin": ["rejected"]},
        })
        stands_left = max(0, num_ent - taken)
        result.append({**ev, "participation": participations.get(ev_id), "stands_left": stands_left})
    return result


@router.post("/events/{event_id}/join")
async def enterprise_join_event(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Enterprise requests to join an event (status = PENDING_ADMIN_APPROVAL)."""
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.get("state") not in ("approved", "waiting_for_payment", "payment_done", "live"):
        raise HTTPException(status_code=400, detail="Event is not open for enterprise participation")

    # Check enterprise stand capacity
    num_enterprises = event.get("num_enterprises") or 0
    db = get_database()
    taken = await db.participants.count_documents({
        "event_id": str(event_id),
        "role": Role.ENTERPRISE.value,
        "status": {"$nin": ["rejected"]},
    })
    if num_enterprises > 0 and taken >= num_enterprises:
        raise HTTPException(status_code=400, detail="No enterprise stand slots remaining for this event")

    org = await get_enterprise_org(current_user)
    org_id = str(org["id"])
    existing = await get_enterprise_participant(event_id, org_id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Already joined this event. Status: {existing['status']}")

    doc = {
        "event_id": str(event_id),
        "organization_id": org_id,
        "user_id": str(current_user["_id"]),
        "role": Role.ENTERPRISE.value,
        "status": ParticipantStatus.PENDING_ADMIN_APPROVAL.value,
        "stand_fee_paid": False,
        "payment_reference": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.participants.insert_one(doc)
    doc["_id"] = result.inserted_id
    return stringify_object_ids(doc)


@router.post("/events/{event_id}/accept-invite")
async def enterprise_accept_invite(
    event_id: str,
    token: Optional[str] = Query(None, min_length=8),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Accept organizer enterprise invite and grant guest-approved access without payment."""
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    stored_token = event.get("enterprise_invite_token")
    legacy_link = event.get("enterprise_link")
    legacy_token = None
    if legacy_link:
        parsed = urlparse(legacy_link)
        legacy_token = parse_qs(parsed.query).get("token", [None])[0]

    if token:
        if not _event_token_is_valid(event, token, "enterprise"):
            raise HTTPException(status_code=403, detail="Invalid or expired enterprise invite token")
    elif stored_token or legacy_token:
        raise HTTPException(status_code=403, detail="Invite token is required for this event")

    org = await get_enterprise_org(current_user)
    org_id = str(org["id"])
    db = get_database()
    now = datetime.now(timezone.utc)

    existing = await get_enterprise_participant(event_id, org_id)
    if existing:
        if _is_accepted_participant_status(existing.get("status")):
            await ensure_enterprise_stand(event_id, org_id, org_hint=org)
            return existing

        from pymongo import ReturnDocument
        pid = existing.get("_id")
        if isinstance(pid, str) and ObjectId.is_valid(pid):
            pid = ObjectId(pid)

        updated = await db.participants.find_one_and_update(
            {"_id": pid},
            {"$set": {
                "status": ParticipantStatus.GUEST_APPROVED.value,
                "stand_fee_paid": True,
                "payment_reference": "invite_guest_access",
                "updated_at": now,
            }},
            return_document=ReturnDocument.AFTER,
        )
        if updated:
            await ensure_enterprise_stand(event_id, org_id, org_hint=org)
            return stringify_object_ids(updated)
        raise HTTPException(status_code=500, detail="Failed to accept invite")

    doc = {
        "event_id": str(event_id),
        "organization_id": org_id,
        "user_id": str(current_user["_id"]),
        "role": Role.ENTERPRISE.value,
        "status": ParticipantStatus.GUEST_APPROVED.value,
        "stand_fee_paid": True,
        "payment_reference": "invite_guest_access",
        "created_at": now,
        "updated_at": now,
    }
    result = await db.participants.insert_one(doc)
    doc["_id"] = result.inserted_id

    await ensure_enterprise_stand(event_id, org_id, org_hint=org)
    return stringify_object_ids(doc)


@router.post("/events/{event_id}/pay")
async def enterprise_pay_stand_fee(
    event_id: str,
    request: "Request",
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Create Payzone payment session for stand fee: returns payment_url for redirect."""
    import math
    from app.modules.marketplace.stripe_service import create_payment_session as st_create

    org = await get_enterprise_org(current_user)
    org_id = str(org["id"])

    participant = await get_enterprise_participant(event_id, org_id)
    if not participant:
        raise HTTPException(status_code=404, detail="No join request found. Please join the event first.")
    if participant.get("status") != ParticipantStatus.PENDING_PAYMENT.value:
        raise HTTPException(status_code=400, detail=f"Cannot pay in current status: {participant.get('status')}")

    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    stand_fee = event.get("stand_price", 0) or 0
    if stand_fee <= 0:
        # Free stand fee — approve directly and provision stand access
        payment_ref = str(uuid.uuid4())
        db = get_database()
        from pymongo import ReturnDocument
        updated = await db.participants.find_one_and_update(
            {"event_id": str(event_id), "organization_id": org_id, "role": Role.ENTERPRISE.value},
            {"$set": {
                "stand_fee_paid": True,
                "payment_reference": payment_ref,
                "status": ParticipantStatus.APPROVED.value,
                "updated_at": datetime.now(timezone.utc),
            }},
            return_document=ReturnDocument.AFTER,
        )
        if updated:
            await ensure_enterprise_stand(event_id, org_id, org_hint=org)
        return stringify_object_ids(updated)

    amount_cents = int(math.ceil(stand_fee * 100))
    participant_id = str(participant["_id"])

    origin = request.headers.get("origin") or request.headers.get("referer") or "http://localhost:3000"
    origin = origin.rstrip("/")
    backend_base = str(request.base_url).rstrip("/")
    success_url = f"{origin}/enterprise/events/payment-success?event_id={event_id}&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/enterprise/events?payment_cancelled=true&event_id={event_id}"
    notification_url = f"{backend_base}/enterprise/events/{event_id}/pay-callback"

    try:
        st_result = st_create(
            order_id=participant_id,
            amount=stand_fee,
            product_name=f"Stand Fee: {event['title']}",
            success_url=success_url,
            cancel_url=cancel_url,
            buyer_email=current_user.get("email"),
            metadata={
                "event_id": event_id, 
                "org_id": org_id, 
                "participant_id": participant_id,
                "source": "enterprise_stand_fee"
            },
            line_items=[{
                'name': f"Stand Fee: {event['title']}",
                'description': f"Stand participation fee for event: {event['title']}",
                'unit_amount': amount_cents,
                'currency': 'mad',
                'quantity': 1,
            }],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Payment provider error: {exc}")

    # Store stripe session id on participant
    db = get_database()
    await db.participants.update_one(
        {"_id": participant["_id"]},
        {"$set": {"stripe_session_id": st_result["session_id"]}},
    )

    return {"payment_url": st_result["url"], "participant_id": participant_id}


@router.post("/events/{event_id}/verify-payment")
async def enterprise_verify_payment(
    event_id: str,
    request: "Request",
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Pull-based verification: frontend calls this after Stripe redirects back to success page."""
    import stripe
    from app.modules.marketplace.stripe_service import create_payment_session as _  # ensure stripe api_key is set
    from app.core.config import settings
    import logging
    logger = logging.getLogger(__name__)
    stripe.api_key = settings.STRIPE_SECRET_KEY

    body = await request.json()
    session_id = body.get("session_id", "")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    org = await get_enterprise_org(current_user)
    org_id = str(org["id"])

    participant = await get_enterprise_participant(event_id, org_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participation not found")

    # Already approved — idempotent
    if _is_accepted_participant_status(participant.get("status")):
        await ensure_enterprise_stand(event_id, org_id, org_hint=org)
        return {"status": "approved"}

    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status != "paid":
            raise HTTPException(status_code=400, detail="Payment not completed on Stripe")
        transaction_id = session.payment_intent or ""
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=400, detail=f"Stripe error: {exc}")

    db = get_database()
    from pymongo import ReturnDocument
    pid = participant["_id"]
    if isinstance(pid, str) and ObjectId.is_valid(pid):
        pid = ObjectId(pid)
    updated = await db.participants.find_one_and_update(
        {"_id": pid},
        {"$set": {
            "stand_fee_paid": True,
            "payment_reference": transaction_id,
            "stripe_session_id": session_id,
            "status": ParticipantStatus.APPROVED.value,
            "updated_at": datetime.now(timezone.utc),
        }},
        return_document=ReturnDocument.AFTER,
    )
    if updated:
        await ensure_enterprise_stand(event_id, org_id, org_hint=org)
        logger.info("Enterprise stand fee verified for %s in event %s", org_id, event_id)
        return {"status": "approved"}
    raise HTTPException(status_code=500, detail="Failed to update participant status")


@router.post("/events/{event_id}/pay-callback")
async def enterprise_pay_callback(event_id: str, request: "Request"):
    """Stripe Webhook callback for enterprise stand fee payments."""
    from app.modules.marketplace.stripe_service import construct_event
    import logging

    logger = logging.getLogger(__name__)

    payload = await request.body()
    sig_header = request.headers.get('stripe-signature', '')

    try:
        event_obj = construct_event(payload, sig_header)
    except Exception as e:
        logger.warning(f"Stripe enterprise callback failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event_obj["type"] == "checkout.session.completed":
        session = event_obj["data"]["object"]
        transaction_id = session.get("payment_intent", "")
        metadata = session.get("metadata", {})
        order_id = metadata.get("participant_id")  # participant_id

        if order_id:
            db = get_database()
            from pymongo import ReturnDocument
            pid = ObjectId(order_id) if ObjectId.is_valid(order_id) else order_id
            updated = await db.participants.find_one_and_update(
                {"_id": pid, "status": ParticipantStatus.PENDING_PAYMENT.value},
                {"$set": {
                    "stand_fee_paid": True,
                    "payment_reference": transaction_id,
                    "status": ParticipantStatus.APPROVED.value,
                    "updated_at": datetime.now(timezone.utc),
                }},
                return_document=ReturnDocument.AFTER,
            )
            if updated:
                org_id = str(updated.get("organization_id") or "")
                if org_id:
                    await ensure_enterprise_stand(event_id, org_id)
                logger.info("Enterprise stand fee paid for participant %s", order_id)

    return {"status": "ok"}


# ─── Week 2: Stand Management (only if APPROVED) ─────────────────────────────

@router.get("/events/{event_id}/stand")
async def get_enterprise_stand(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Get the enterprise's stand (only if APPROVED)."""
    org = await get_enterprise_org(current_user)
    return await get_approved_stand(event_id, str(org["id"]), current_user)


@router.patch("/events/{event_id}/stand")
async def update_enterprise_stand(
    event_id: str,
    data: dict,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Update branding/description of enterprise stand (only if APPROVED)."""
    org = await get_enterprise_org(current_user)
    stand = await get_approved_stand(event_id, str(org["id"]), current_user)

    allowed_fields = {"name", "description", "logo_url", "theme_color", "stand_background_url",
                      "presenter_name", "presenter_avatar_url", "presenter_avatar_bg", "tags", "category"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}
    if not update_data:
        return stand
    return await update_stand(stand["id"], update_data)


@router.patch("/events/{event_id}/stand/products")
async def link_products_to_stand(
    event_id: str,
    payload: List[Any],
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Link enterprise catalog products/services to stand and sync marketplace catalog entries."""
    org = await get_enterprise_org(current_user)
    stand = await get_approved_stand(event_id, str(org["id"]), current_user)

    db = get_database()
    valid_ids: List[str] = []
    product_links: List[dict] = []
    synced_docs: List[dict] = []

    for item in payload:
        pid: Optional[str] = None
        selected_quantity: Optional[int] = None

        if isinstance(item, str):
            pid = item
        elif isinstance(item, dict):
            pid = str(item.get("product_id") or item.get("id") or "")
            raw_qty = item.get("quantity")
            if raw_qty is not None:
                try:
                    selected_quantity = int(raw_qty)
                except (TypeError, ValueError):
                    selected_quantity = None

        if not pid or not ObjectId.is_valid(pid):
            continue

        prod = await db.products.find_one({
            "_id": ObjectId(pid),
            "enterprise_id": str(current_user["_id"]),
            "is_active": True,
        })
        if not prod:
            continue

        product_type = str(prod.get("type") or "product")
        quantity = None
        if product_type != "service":
            quantity = max(1, selected_quantity or int(prod.get("stock") or 1))

        valid_ids.append(str(pid))
        product_links.append({"product_id": str(pid), "quantity": quantity})
        synced_docs.append(
            {
                "source_product_id": ObjectId(pid),
                "name": str(prod.get("name") or ""),
                "description": str(prod.get("description") or ""),
                "price": float(prod.get("price") or 0),
                "currency": str(prod.get("currency") or "MAD"),
                "image_url": str(prod.get("image_url") or ""),
                "stock": 0 if product_type == "service" else int(quantity or 1),
                "type": product_type,
            }
        )

    from pymongo import ReturnDocument
    stand_oid = ObjectId(stand["id"]) if ObjectId.is_valid(stand["id"]) else stand["id"]

    for sync_doc in synced_docs:
        await db.stand_products.update_one(
            {
                "stand_id": stand_oid,
                "source_product_id": sync_doc["source_product_id"],
            },
            {
                "$set": {
                    "name": sync_doc["name"],
                    "description": sync_doc["description"],
                    "price": sync_doc["price"],
                    "currency": sync_doc["currency"],
                    "image_url": sync_doc["image_url"],
                    "stock": sync_doc["stock"],
                    "type": sync_doc["type"],
                },
                "$setOnInsert": {
                    "stand_id": stand_oid,
                    "source_product_id": sync_doc["source_product_id"],
                    "created_at": datetime.now(timezone.utc),
                },
            },
            upsert=True,
        )

    source_oids = [doc["source_product_id"] for doc in synced_docs]
    cleanup_filter: dict[str, Any] = {
        "stand_id": stand_oid,
        "source_product_id": {"$exists": True},
    }
    if source_oids:
        cleanup_filter["source_product_id"] = {"$nin": source_oids}
    await db.stand_products.delete_many(cleanup_filter)

    updated = await db.stands.find_one_and_update(
        {"_id": stand_oid},
        {"$set": {"products": valid_ids, "product_links": product_links}},
        return_document=ReturnDocument.AFTER,
    )
    return stringify_object_ids(updated)


@router.post("/events/{event_id}/stand/resources")
async def upload_stand_resource(
    event_id: str,
    title: str = Form(...),
    type: str = Form(...),
    url: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Link a URL-based or File-based resource to the enterprise stand."""
    org = await get_enterprise_org(current_user)
    stand = await get_approved_stand(event_id, str(org["id"]), current_user)

    file_path = url or ""
    
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1] or ""
        safe_name = f"{stand['id']}_{uuid.uuid4().hex}{ext}"
        upload_dir = "uploads/stand_resources"
        os.makedirs(upload_dir, exist_ok=True)
        save_path = os.path.join(upload_dir, safe_name)
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_path = f"/{upload_dir}/{safe_name}"

    db = get_database()
    
    # Calculate file size if uploaded
    file_size = 0
    mime_type = "application/octet-stream"
    if file and file.filename:
        file_size = os.path.getsize(save_path)
        mime_type = file.content_type or mime_type

    resource_doc = {
        "stand_id": str(stand["id"]),
        "title": title or "Untitled",
        "description": "",
        "type": type,
        "tags": [],
        "file_path": file_path,
        "file_size": file_size,
        "mime_type": mime_type,
        "uploaded_by": str(current_user["_id"]),
        "upload_date": datetime.now(timezone.utc),
        "downloads": 0,
    }
    result = await db.resources.insert_one(resource_doc)
    resource_doc["_id"] = result.inserted_id
    return stringify_object_ids(resource_doc)


@router.post("/events/{event_id}/stand/enable-assistant")
async def enable_stand_assistant(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Index stand resources into RAG and enable AI assistant. Fail-soft."""
    org = await get_enterprise_org(current_user)
    stand = await get_approved_stand(event_id, str(org["id"]), current_user)
    stand_id = str(stand["id"])

    db = get_database()
    resources = await db.resources.find({"stand_id": stand_id}).to_list(length=100)
    rag_scope = f"stand-{stand_id}"
    indexed_count = 0

    try:
        from app.modules.ai_rag.service import rag_service
        for res in resources:
            content = f"Title: {res.get('title', '')}\nType: {res.get('type', '')}\nURL: {res.get('file_path', '')}"
            await rag_service.ingest_document(content=content, scope=rag_scope, source=res.get("title", "unknown"))
            indexed_count += 1
        await db.stands.update_one(
            {"_id": ObjectId(stand_id)},
            {"$set": {"rag_enabled": True, "rag_last_indexed": datetime.now(timezone.utc)}},
        )
    except Exception as e:
        return {"rag_enabled": False, "message": f"RAG indexing failed (non-critical): {str(e)}", "indexed_documents": 0}

    return {"rag_enabled": True, "indexed_documents": indexed_count, "scope": rag_scope, "last_indexed_at": datetime.now(timezone.utc).isoformat()}


@router.get("/events/{event_id}/stand/assistant-status")
async def get_assistant_status(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Get RAG assistant status for the enterprise's stand."""
    org = await get_enterprise_org(current_user)
    stand = await get_approved_stand(event_id, str(org["id"]), current_user)
    stand_id = str(stand["id"])

    db = get_database()
    resource_count = await db.resources.count_documents({"stand_id": stand_id})
    return {
        "rag_enabled": stand.get("rag_enabled", False),
        "indexed_documents_count": resource_count,
        "last_indexed_at": stand.get("rag_last_indexed"),
    }
