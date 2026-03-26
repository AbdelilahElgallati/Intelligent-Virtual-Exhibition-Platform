"""
Admin-specific routes: /admin/health, /admin/events/{event_id}/enterprise-requests,
/admin/events/{event_id}/force-start, /admin/events/{event_id}/force-close,
/admin/event-join-requests, /admin/events/{event_id}/enterprises/{org_id}/approve|reject
"""
import time
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from datetime import datetime, timezone

from app.core.dependencies import require_role
from app.modules.auth.enums import Role
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from app.modules.participants.schemas import EnterpriseRequestsResponse, ParticipantStatus
from app.modules.participants.service import list_enterprise_requests
from app.modules.events.service import get_event_by_id, atomic_transition, resolve_event_id
from app.modules.events.schemas import EventRead, EventState
from app.modules.audit.service import log_audit
from app.modules.stands.service import get_stand_by_org, create_stand
from app.modules.organizations.service import list_organizations
from app.modules.admin.schemas import PartnerDashboardRead, PartnerStats
from app.modules.users.service import list_all_users
from bson import ObjectId

router = APIRouter(prefix="/admin", tags=["Admin"])


# Record process start time for uptime calculation
_START_TIME = time.time()


@router.get("/health")
async def admin_health(
    _: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Detailed platform health status (Admin only).
    Returns MongoDB connection status, uptime, and worker/process info.
    """
    # MongoDB ping
    mongo_ok = False
    mongo_latency_ms = None
    try:
        db = get_database()
        t0 = time.monotonic()
        await db.command("ping")
        mongo_latency_ms = round((time.monotonic() - t0) * 1000, 1)
        mongo_ok = True
    except Exception:
        mongo_latency_ms = None

    uptime_seconds = int(time.time() - _START_TIME)
    uptime_str = _format_uptime(uptime_seconds)

    # Redis — we don't have redis configured yet, report as "not configured"
    redis_status = "not_configured"

    overall = "healthy" if mongo_ok else "degraded"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": uptime_str,
        "uptime_seconds": uptime_seconds,
        "services": {
            "mongodb": {
                "status": "ok" if mongo_ok else "error",
                "latency_ms": mongo_latency_ms,
            },
            "redis": {
                "status": redis_status,
                "latency_ms": None,
            },
            "api": {
                "status": "ok",
                "pid": os.getpid(),
            },
        },
    }


@router.get("/events/{event_id}/enterprise-requests", response_model=EnterpriseRequestsResponse)
async def get_enterprise_requests(
    event_id: str,
    status: str = Query(default="pending_admin_approval", description="Filter by participant status"),
    search: Optional[str] = Query(default=None, description="Search by org name / email"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    _: dict = Depends(require_role(Role.ADMIN)),
) -> EnterpriseRequestsResponse:
    """
    Admin: List enterprise join requests for a given event.

    Returns enriched items including:
    - participant status & dates
    - enterprise user details
    - organization info (name, industry)
    - subscription plan
    - participation history

    Filters: status, search (org name / email), skip, limit
    """
    event_id = await resolve_event_id(event_id)
    result = await list_enterprise_requests(
        event_id=event_id,
        status=status,
        search=search,
        skip=skip,
        limit=limit,
    )
    return EnterpriseRequestsResponse(**result)


# ─── Force lifecycle transitions ─────────────────────────────────────────────

@router.post(
    "/events/{event_id}/force-start",
    response_model=EventRead,
    summary="Force-start an event (Admin only)",
)
async def force_start_event(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Force an event from PAYMENT_DONE → LIVE immediately, bypassing the schedule.

    - ADMIN only
    - Allowed only when `state == payment_done`
    - Audit log: `event.force_start`
    """
    event_id = await resolve_event_id(event_id)
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["state"] != EventState.PAYMENT_DONE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot force-start. Current state: {event['state']}. Required: payment_done",
        )

    updated = await atomic_transition(event_id, EventState.PAYMENT_DONE, EventState.LIVE)
    if updated is None:
        # Race — already transitioned
        updated = await get_event_by_id(event_id)

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event.force_start",
        entity="event",
        entity_id=event_id,
        metadata={
            "event_id": event_id,
            "previous_state": "payment_done",
            "new_state": "live",
            "actor_id": str(current_user["_id"]),
            "title": event.get("title"),
        },
    )

    return EventRead(**updated)


@router.post(
    "/events/{event_id}/force-close",
    response_model=EventRead,
    summary="Force-close an event (Admin only)",
)
async def force_close_event(
    event_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> EventRead:
    """
    Force an event from LIVE → CLOSED immediately.

    - ADMIN only
    - Allowed only when `state == live`
    - Audit log: `event.force_close`
    """
    event_id = await resolve_event_id(event_id)
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event["state"] != EventState.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot force-close. Current state: {event['state']}. Required: live",
        )

    updated = await atomic_transition(event_id, EventState.LIVE, EventState.CLOSED)
    if updated is None:
        updated = await get_event_by_id(event_id)

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="event.force_close",
        entity="event",
        entity_id=event_id,
        metadata={
            "event_id": event_id,
            "previous_state": "live",
            "new_state": "closed",
            "actor_id": str(current_user["_id"]),
            "title": event.get("title"),
        },
    )

    return EventRead(**updated)


def _format_uptime(seconds: int) -> str:
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    if days:
        return f"{days}d {hours}h {minutes}m"
    if hours:
        return f"{hours}h {minutes}m {secs}s"
    return f"{minutes}m {secs}s"


# ─── Enterprise Registrations ──────────────────────────────────────────────────

@router.get("/enterprise-registrations")
async def get_enterprise_registrations(
    approval_status: Optional[str] = Query(None, description="Filter: PENDING_APPROVAL, APPROVED, REJECTED"),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    db = get_database()
    query = {"role": Role.ENTERPRISE}
    if approval_status:
        query["approval_status"] = approval_status
    
    users_cursor = db.users.find(query).sort("created_at", -1)
    users = await users_cursor.to_list(length=200)
    
    registrations = []
    for user in users:
        user_id = str(user["_id"])
        org = await db.organizations.find_one({"owner_id": user_id})
        
        registrations.append({
            "_id": user_id,
            "full_name": user.get("full_name"),
            "email": user.get("email"),
            "approval_status": user.get("approval_status", "PENDING_APPROVAL"),
            "created_at": user.get("created_at"),
            "organization": stringify_object_ids(org) if org else None,
        })
        
    return {"registrations": registrations, "total": len(registrations)}

@router.post("/enterprise-registrations/{user_id}/approve")
async def approve_enterprise(user_id: str, current_user: dict = Depends(require_role(Role.ADMIN))):
    db = get_database()
    user_id_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    result = await db.users.update_one(
        {"_id": user_id_obj, "role": Role.ENTERPRISE},
        {"$set": {"approval_status": "APPROVED", "is_active": True, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enterprise user not found")
    await log_audit(actor_id=str(current_user["_id"]), action="enterprise.registration_approved", entity="user", entity_id=user_id)
    return {"message": "Enterprise approved"}

@router.post("/enterprise-registrations/{user_id}/reject")
async def reject_enterprise(user_id: str, payload: dict = Body(...), current_user: dict = Depends(require_role(Role.ADMIN))):
    db = get_database()
    reason = payload.get("reason", "")
    user_id_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    result = await db.users.update_one(
        {"_id": user_id_obj, "role": Role.ENTERPRISE},
        {"$set": {"approval_status": "REJECTED", "rejection_reason": reason, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enterprise user not found")
    await log_audit(actor_id=str(current_user["_id"]), action="enterprise.registration_rejected", entity="user", entity_id=user_id, metadata={"reason": reason})
    return {"message": "Enterprise rejected"}

# ─── Organizer Registrations ──────────────────────────────────────────────────

@router.get("/organizer-registrations")
async def get_organizer_registrations(
    approval_status: Optional[str] = Query(None, description="Filter: PENDING_APPROVAL, APPROVED, REJECTED"),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    db = get_database()
    query = {"role": Role.ORGANIZER}
    if approval_status:
        query["approval_status"] = approval_status
    
    users_cursor = db.users.find(query).sort("created_at", -1)
    users = await users_cursor.to_list(length=200)
    
    registrations = []
    for user in users:
        user_id = str(user["_id"])
        
        registrations.append({
            "_id": user_id,
            "full_name": user.get("full_name"),
            "email": user.get("email"),
            "org_name": user.get("org_name", ""),
            "org_type": user.get("org_type", ""),
            "org_country": user.get("org_country", ""),
            "org_city": user.get("org_city", ""),
            "org_phone": user.get("org_phone", ""),
            "org_website": user.get("org_website", ""),
            "org_professional_email": user.get("org_professional_email", ""),
            "approval_status": user.get("approval_status", "PENDING_APPROVAL"),
            "created_at": user.get("created_at"),
        })
        
    return {"registrations": registrations, "total": len(registrations)}

@router.post("/organizer-registrations/{user_id}/approve")
async def approve_organizer(user_id: str, current_user: dict = Depends(require_role(Role.ADMIN))):
    db = get_database()
    user_id_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    result = await db.users.update_one(
        {"_id": user_id_obj, "role": Role.ORGANIZER},
        {"$set": {"approval_status": "APPROVED", "is_active": True, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organizer user not found")
    await log_audit(actor_id=str(current_user["_id"]), action="organizer.registration_approved", entity="user", entity_id=user_id)
    return {"message": "Organizer approved"}

@router.post("/organizer-registrations/{user_id}/reject")
async def reject_organizer(user_id: str, payload: dict = Body(...), current_user: dict = Depends(require_role(Role.ADMIN))):
    db = get_database()
    reason = payload.get("reason", "")
    user_id_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    result = await db.users.update_one(
        {"_id": user_id_obj, "role": Role.ORGANIZER},
        {"$set": {"approval_status": "REJECTED", "rejection_reason": reason, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organizer user not found")
    await log_audit(actor_id=str(current_user["_id"]), action="organizer.registration_rejected", entity="user", entity_id=user_id, metadata={"reason": reason})
    return {"message": "Organizer rejected"}

# ─── Detailed Partners (Organizations/Enterprises) ──────────────────────────────────────────────────

@router.get("/organizations/detailed", response_model=list[PartnerDashboardRead])
async def get_detailed_organizations(current_user: dict = Depends(require_role(Role.ADMIN))):
    db = get_database()
    users_cursor = db.users.find({"role": Role.ORGANIZER})
    organizer_users = await users_cursor.to_list(length=500)
    
    detailed_orgs = []
    for user in organizer_users:
        user_id = str(user["_id"])
        
        org = await db.organizations.find_one({"owner_id": user_id})
        
        events_count = await db.events.count_documents({"organizer_id": user_id})
        
        event_ids_cursor = db.events.find({"organizer_id": user_id}, {"_id": 1})
        event_ids_docs = await event_ids_cursor.to_list(length=None)
        event_ids = [str(e["_id"]) for e in event_ids_docs]
        
        visitors_count = await db.participants.count_documents({"event_id": {"$in": event_ids}})
        
        revenue = await db.payments.aggregate([
            {"$match": {"event_id": {"$in": event_ids}, "status": "APPROVED"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(length=1)
        total_revenue = revenue[0]["total"] if revenue else 0.0

        org_data = {
            "_id": str(org["_id"]) if org else user_id,
            "name": org.get("name") if org else user.get("org_name", user.get("full_name", "Unknown")),
            "description": org.get("description") if org else None,
            "industry": org.get("industry") if org else user.get("org_type", "General"),
            "website": org.get("website") if org else user.get("org_website", None),
            "contact_email": org.get("professional_email") if org else user.get("org_professional_email", user.get("email")),
            "logo_url": org.get("logo_url") if org else None,
            "owner_id": user_id,
            "owner_name": user.get("full_name"),
            "owner_email": user.get("email"),
            "owner_role": "organizer",
            "is_verified": bool(org.get("is_verified")) if org else False,
            "is_flagged": bool(org.get("is_flagged")) if org else False,
            "is_suspended": bool(org.get("is_suspended")) if org else not bool(user.get("is_active", True)),
            "stats": PartnerStats(
                total_events=events_count,
                total_visitors=visitors_count,
                total_revenue=total_revenue
            ),
            "created_at": org.get("created_at") if org else user.get("created_at")
        }
        detailed_orgs.append(org_data)
        
    return detailed_orgs

@router.get("/enterprises/detailed", response_model=list[PartnerDashboardRead])
async def get_detailed_enterprises(current_user: dict = Depends(require_role(Role.ADMIN))):
    db = get_database()
    users_cursor = db.users.find({"role": Role.ENTERPRISE})
    enterprise_users = await users_cursor.to_list(length=500)
    
    detailed_enterprises = []
    for user in enterprise_users:
        user_id = str(user["_id"])
        
        org = await db.organizations.find_one({"owner_id": user_id})
        org_id = str(org["_id"]) if org else None

        if org_id:
            stands = await db.stands.find({"organization_id": org_id}, {"_id": 1}).to_list(length=None)
            stand_ids = [str(s["_id"]) for s in stands]
            stands_count = len(stand_ids)
            leads_count = await db.leads.count_documents({"stand_id": {"$in": stand_ids}}) if stand_ids else 0
            meetings_count = await db.meetings.count_documents({"stand_id": {"$in": stand_ids}}) if stand_ids else 0
        else:
            stands_count = 0
            leads_count = 0
            meetings_count = 0

        ent_data = {
            "_id": str(org["_id"]) if org else user_id,
            "name": org.get("name") if org else user.get("full_name", "Unknown"),
            "description": org.get("description") if org else None,
            "industry": org.get("industry") if org else "General",
            "website": org.get("website") if org else None,
            "contact_email": org.get("professional_email") if org else user.get("email"),
            "logo_url": org.get("logo_url") if org else None,
            "owner_id": user_id,
            "owner_name": user.get("full_name"),
            "owner_email": user.get("email"),
            "owner_role": "enterprise",
            "is_verified": bool(org.get("is_verified")) if org else False,
            "is_flagged": bool(org.get("is_flagged")) if org else False,
            "is_suspended": bool(org.get("is_suspended")) if org else not bool(user.get("is_active", True)),
            "stats": PartnerStats(
                total_stands=stands_count,
                total_leads=leads_count,
                total_meetings=meetings_count
            ),
            "created_at": org.get("created_at") if org else user.get("created_at")
        }
        detailed_enterprises.append(ent_data)
        
    return detailed_enterprises
