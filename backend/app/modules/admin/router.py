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
from app.modules.events.service import get_event_by_id, atomic_transition
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


# ── ENTERPRISE REGISTRATION APPROVAL ─────────────────────────────────────────

@router.get("/enterprise-registrations")
async def list_enterprise_registrations(
    approval_status: Optional[str] = Query(None, description="Filter: PENDING_APPROVAL, APPROVED, REJECTED"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    List enterprise account registration requests with org info for admin review.
    Filter by approval_status: PENDING_APPROVAL | APPROVED | REJECTED
    """
    db = get_database()
    query: dict = {"role": "enterprise"}
    if approval_status:
        query["approval_status"] = approval_status.upper()

    cursor = db.users.find(query, {
        "hashed_password": 0,
    }).sort("created_at", -1).skip(skip).limit(limit)

    docs = []
    async for doc in cursor:
        user_doc = stringify_object_ids(doc)
        # Enrich with organization data
        org_id = user_doc.get("organization_id")
        if not org_id:
            # Try to find org by owner
            try:
                org = await db.organizations.find_one({"owner_id": str(user_doc["_id"])})
                if org:
                    org_data = stringify_object_ids(org)
                    user_doc["organization"] = org_data
            except Exception:
                pass
        else:
            try:
                org = await db.organizations.find_one(
                    {"_id": ObjectId(org_id)} if ObjectId.is_valid(str(org_id)) else {"_id": org_id}
                )
                if org:
                    user_doc["organization"] = stringify_object_ids(org)
            except Exception:
                pass
        docs.append(user_doc)

    total = await db.users.count_documents(query)
    return {"total": total, "registrations": docs}


@router.post("/enterprise-registrations/{user_id}/approve")
async def approve_enterprise_registration(
    user_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Approve an enterprise's registration — activates their account.
    """
    db = get_database()
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"_id": user_id}

    user = await db.users.find_one({**q, "role": "enterprise"})
    if not user:
        raise HTTPException(status_code=404, detail="Enterprise user not found")

    await db.users.update_one(q, {"$set": {
        "is_active": True,
        "approval_status": "APPROVED",
        "approved_at": datetime.now(timezone.utc),
        "approved_by": str(current_user["_id"]),
    }})

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="enterprise.registration_approved",
        entity="user",
        entity_id=user_id,
        metadata={"enterprise_email": user.get("email"), "full_name": user.get("full_name")},
    )

    return {"status": "approved", "user_id": user_id}


@router.post("/enterprise-registrations/{user_id}/reject")
async def reject_enterprise_registration(
    user_id: str,
    reason: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Reject an enterprise's registration — keeps account inactive.
    """
    db = get_database()
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"_id": user_id}

    user = await db.users.find_one({**q, "role": "enterprise"})
    if not user:
        raise HTTPException(status_code=404, detail="Enterprise user not found")

    await db.users.update_one(q, {"$set": {
        "is_active": False,
        "approval_status": "REJECTED",
        "rejected_at": datetime.now(timezone.utc),
        "rejected_by": str(current_user["_id"]),
        "rejection_reason": reason,
    }})

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="enterprise.registration_rejected",
        entity="user",
        entity_id=user_id,
        metadata={"enterprise_email": user.get("email"), "reason": reason},
    )

    return {"status": "rejected", "user_id": user_id}


# ── ORGANIZER REGISTRATION APPROVAL ──────────────────────────────────────────

@router.get("/organizer-registrations")
async def list_organizer_registrations(
    approval_status: Optional[str] = Query(None, description="Filter: PENDING_APPROVAL, APPROVED, REJECTED"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    List organizer registration requests, with full profile info for admin review.
    Filter by approval_status: PENDING_APPROVAL | APPROVED | REJECTED
    """
    db = get_database()
    query: dict = {"role": "organizer"}
    if approval_status:
        query["approval_status"] = approval_status.upper()

    cursor = db.users.find(query, {
        "hashed_password": 0,  # never expose password hash
    }).sort("created_at", -1).skip(skip).limit(limit)

    docs = []
    async for doc in cursor:
        docs.append(stringify_object_ids(doc))

    total = await db.users.count_documents(query)
    return {"total": total, "registrations": docs}


@router.post("/organizer-registrations/{user_id}/approve")
async def approve_organizer_registration(
    user_id: str,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Approve an organizer's registration — activates their account.
    """
    db = get_database()
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"_id": user_id}

    user = await db.users.find_one({**q, "role": "organizer"})
    if not user:
        raise HTTPException(status_code=404, detail="Organizer not found")

    await db.users.update_one(q, {"$set": {
        "is_active": True,
        "approval_status": "APPROVED",
        "approved_at": datetime.now(timezone.utc),
        "approved_by": str(current_user["_id"]),
    }})

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="organizer.registration_approved",
        entity="user",
        entity_id=user_id,
        metadata={"organizer_email": user.get("email"), "org_name": user.get("org_name")},
    )

    return {"status": "approved", "user_id": user_id}


@router.post("/organizer-registrations/{user_id}/reject")
async def reject_organizer_registration(
    user_id: str,
    reason: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Reject an organizer's registration — keeps account inactive.
    """
    db = get_database()
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"_id": user_id}

    user = await db.users.find_one({**q, "role": "organizer"})
    if not user:
        raise HTTPException(status_code=404, detail="Organizer not found")

    await db.users.update_one(q, {"$set": {
        "is_active": False,
        "approval_status": "REJECTED",
        "rejected_at": datetime.now(timezone.utc),
        "rejected_by": str(current_user["_id"]),
        "rejection_reason": reason,
    }})

    await log_audit(
        actor_id=str(current_user["_id"]),
        action="organizer.registration_rejected",
        entity="user",
        entity_id=user_id,
        metadata={"organizer_email": user.get("email"), "reason": reason},
    )

    return {"status": "rejected", "user_id": user_id}


# ── DETAILED PARTNER DASHBOARDS ──────────────────────────────────────────────

@router.get("/organizations/detailed", response_model=list[PartnerDashboardRead])
async def get_detailed_organizations(
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> list[PartnerDashboardRead]:
    """
    Admin: List all organizer partners with aggregated performance statistics.
    """
    db = get_database()
    # 1. Get all users with role organizer
    users_cursor = db.users.find({"role": Role.ORGANIZER})
    organizer_users = await users_cursor.to_list(length=200)
    
    detailed_orgs = []
    
    for user in organizer_users:
        user_id = str(user["_id"])
        
        # Get Organization details for this organizer
        org = await db.organizations.find_one({"owner_id": user_id})
        
        # Aggregate Stats
        # total_events: events created by this owner
        total_events = await db.events.count_documents({"organizer_id": user_id})
        
        # total_visitors: sum of participants across all these events
        event_ids = await db.events.distinct("_id", {"organizer_id": user_id})
        event_ids_str = [str(eid) for eid in event_ids]
        total_visitors = await db.participants.count_documents({"event_id": {"$in": event_ids_str}})
        
        # total_revenue: sum of payment_amount from events (platform revenue from this organizer)
        pipeline = [
            {"$match": {"organizer_id": user_id, "payment_amount": {"$ne": None}}},
            {"$group": {"_id": None, "total": {"$sum": "$payment_amount"}}}
        ]
        rev_res = await db.events.aggregate(pipeline).to_list(length=1)
        total_revenue = rev_res[0]["total"] if rev_res else 0.0
        
        stats = PartnerStats(
            total_events=total_events,
            total_visitors=total_visitors,
            total_revenue=float(total_revenue)
        )
        
        if org:
            org_data = stringify_object_ids(org)
            org_data.update({
                "owner_id": user_id,
                "owner_name": user.get("full_name") or "Unknown",
                "owner_email": user.get("email") or "Unknown",
                "owner_role": "organizer",
                "stats": stats,
                "created_at": org.get("created_at", datetime.now(timezone.utc))
            })
            detailed_orgs.append(PartnerDashboardRead(**org_data))
        else:
            data = PartnerDashboardRead(
                id=user_id,
                name=user.get("org_name") or user.get("full_name", "Unknown Organizer"),
                description=user.get("bio", "Organizer account"),
                industry="Events",
                owner_id=user_id,
                owner_name=user.get("full_name"),
                owner_email=user.get("email"),
                owner_role="organizer",
                stats=stats,
                created_at=user.get("created_at", datetime.now(timezone.utc))
            )
            detailed_orgs.append(data)
        
    return detailed_orgs


@router.get("/enterprises/detailed", response_model=list[PartnerDashboardRead])
async def get_detailed_enterprises(
    current_user: dict = Depends(require_role(Role.ADMIN)),
) -> list[PartnerDashboardRead]:
    """
    Admin: List all enterprise partners with aggregated performance statistics.
    """
    db = get_database()
    # 1. Get all users with role enterprise
    users_cursor = db.users.find({"role": Role.ENTERPRISE})
    enterprise_users = await users_cursor.to_list(length=200)
    
    detailed_enterprises = []
    
    for user in enterprise_users:
        user_id = str(user["_id"])
        org_id = user.get("organization_id")
        
        # Get Organization details
        org = None
        if org_id:
            org = await db.organizations.find_one({"_id": ObjectId(org_id) if ObjectId.is_valid(org_id) else org_id})
        
        if not org:
            # Fallback for older data or direct owner link
            org = await db.organizations.find_one({"owner_id": user_id})
            if org:
                org_id = str(org["_id"])

        # Aggregate Stats
        # total_stands: count of stands belonging to this org
        total_stands = 0
        total_leads = 0
        if org_id:
            total_stands = await db.stands.count_documents({"organization_id": str(org_id)})
            total_leads = await db.leads.count_documents({"organization_id": str(org_id)})
        
        # total_meetings: sum of chat rooms where this user is a member
        total_meetings = await db.chat_rooms.count_documents({"members": user_id})

        stats = PartnerStats(
            total_stands=total_stands,
            total_leads=total_leads,
            total_meetings=total_meetings
        )
        
        # If org exists, use its info, otherwise use user profile info as fallback
        if org:
            org_data = stringify_object_ids(org)
            org_data.update({
                "owner_id": user_id,
                "owner_name": user.get("full_name"),
                "owner_email": user.get("email"),
                "owner_role": "enterprise",
                "stats": stats
            })
            data = PartnerDashboardRead(**org_data)
        else:
            data = PartnerDashboardRead(
                id=user_id,
                name=user.get("full_name", "Unknown Enterprise"),
                description=user.get("bio", "Enterprise account"),
                industry="Exhibitor",
                owner_id=user_id,
                owner_name=user.get("full_name"),
                owner_email=user.get("email"),
                owner_role="enterprise",
                stats=stats,
                created_at=user.get("created_at", datetime.now(timezone.utc))
            )
            
        detailed_enterprises.append(data)
        
    return detailed_enterprises
