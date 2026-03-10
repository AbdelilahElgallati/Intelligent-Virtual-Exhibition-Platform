from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os
import shutil

from app.core.dependencies import require_role
from app.modules.auth.enums import Role
from app.modules.organizations.service import get_organizations_collection, list_organizations
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
from app.modules.leads.repository import lead_repo
from app.modules.leads.schemas import LeadInteraction
from app.modules.stands.service import get_stand_by_org
from app.modules.participants.schemas import ParticipantStatus
from app.modules.events.service import get_event_by_id
from app.modules.stands.service import get_stand_by_org, update_stand
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
    """Find the organization owned by the enterprise user."""
    orgs = await list_organizations()
    for org in orgs:
        if str(org.get("owner_id")) == str(current_user.get("_id")):
            return org
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


async def get_approved_stand(event_id: str, org_id: str, current_user: dict) -> dict:
    """Guard helper — returns stand only if enterprise is APPROVED for the event."""
    participant = await get_enterprise_participant(event_id, org_id)
    if not participant or participant.get("status") != ParticipantStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enterprise not approved for this event",
        )
    stand = await get_stand_by_org(event_id, org_id)
    if not stand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")
    return stand


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


@router.post("/products/{product_id}/images")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Upload an image for a product and append its URL to images[]."""
    # Validate it's an image
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    safe_name = f"{product_id}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(PRODUCT_IMAGE_DIR, safe_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Build a URL the frontend can reach via the /uploads static mount
    image_url = f"/uploads/product_images/{safe_name}"

    updated = await enterprise_repo.add_product_image(product_id, str(current_user["_id"]), image_url)
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    return {"image_url": image_url, "images": updated.get("images", [])}


@router.delete("/products/{product_id}/images")
async def remove_product_image(
    product_id: str,
    image_url: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Remove a specific image URL from a product's images list."""
    updated = await enterprise_repo.remove_product_image(product_id, str(current_user["_id"]), image_url)
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    return {"images": updated.get("images", [])}


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
    if not product.get("is_service") and data.quantity is not None and data.quantity > 0:
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
        
        await lead_repo.log_interaction(LeadInteraction(
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
    org = await get_enterprise_org(current_user)

    cursor = db.events.find({"state": {"$in": ["approved", "live", "waiting_for_payment", "payment_done"]}})
    all_events = stringify_object_ids(await cursor.to_list(length=200))

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
    """Enterprise requests to join an event (status = PENDING_PAYMENT)."""
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
        "status": ParticipantStatus.PENDING_PAYMENT,
        "stand_fee_paid": False,
        "payment_reference": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.participants.insert_one(doc)
    doc["_id"] = result.inserted_id
    return stringify_object_ids(doc)


@router.post("/events/{event_id}/pay")
async def enterprise_pay_stand_fee(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Simulate stand fee payment: PENDING_PAYMENT → PENDING_ADMIN_APPROVAL."""
    org = await get_enterprise_org(current_user)
    org_id = str(org["id"])

    participant = await get_enterprise_participant(event_id, org_id)
    if not participant:
        raise HTTPException(status_code=404, detail="No join request found. Please join the event first.")
    if participant.get("status") != ParticipantStatus.PENDING_PAYMENT:
        raise HTTPException(status_code=400, detail=f"Cannot pay in current status: {participant.get('status')}")

    payment_ref = str(uuid.uuid4())
    db = get_database()
    from pymongo import ReturnDocument
    updated = await db.participants.find_one_and_update(
        {"event_id": str(event_id), "organization_id": org_id, "role": Role.ENTERPRISE.value},
        {"$set": {
            "stand_fee_paid": True,
            "payment_reference": payment_ref,
            "status": ParticipantStatus.PENDING_ADMIN_APPROVAL,
        }},
        return_document=ReturnDocument.AFTER,
    )
    return stringify_object_ids(updated)


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
                      "presenter_name", "presenter_avatar_url", "tags", "category"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields and v is not None}
    if not update_data:
        return stand
    return await update_stand(stand["id"], update_data)


@router.patch("/events/{event_id}/stand/products")
async def link_products_to_stand(
    event_id: str,
    product_ids: List[str],
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Link enterprise products to the stand (deduplication + ownership check)."""
    org = await get_enterprise_org(current_user)
    stand = await get_approved_stand(event_id, str(org["id"]), current_user)

    db = get_database()
    valid_ids = []
    for pid in product_ids:
        if ObjectId.is_valid(pid):
            prod = await db.products.find_one({
                "_id": ObjectId(pid),
                "enterprise_id": str(current_user["_id"]),
                "is_active": True,
            })
            if prod:
                valid_ids.append(str(pid))

    from pymongo import ReturnDocument
    updated = await db.stands.find_one_and_update(
        {"_id": ObjectId(stand["id"])},
        {"$set": {"products": valid_ids}},
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
