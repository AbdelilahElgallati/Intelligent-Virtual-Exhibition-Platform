"""
Audit log router — GET /audit with flexible filters (Admin only).
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime

from app.core.dependencies import require_role
from app.modules.auth.enums import Role
from .schemas import AuditLogRead
from .service import list_audit_logs, count_audit_logs

router = APIRouter(prefix="/audit", tags=["Audit"])

KNOWN_ACTIONS = [
    "event.approve", "event.reject", "event.start", "event.close",
    "user.suspend", "user.activate",
    "organization.verify", "organization.flag", "organization.suspend",
    "subscription.override", "subscription.cancel",
    "incident.create", "incident.update",
]


@router.get("/", response_model=List[AuditLogRead])
async def get_audit_logs(
    actor_id: Optional[str] = Query(None, description="Filter by actor user ID"),
    action: Optional[str] = Query(None, description="Filter by action string"),
    entity: Optional[str] = Query(None, description="Filter by entity type"),
    from_date: Optional[datetime] = Query(None, description="Start of date range (ISO 8601)"),
    to_date: Optional[datetime] = Query(None, description="End of date range (ISO 8601)"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    """List audit log entries (Admin only). Supports filtering and pagination."""
    logs = await list_audit_logs(
        actor_id=actor_id,
        action=action,
        entity=entity,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        skip=skip,
    )
    return [AuditLogRead(**log) for log in logs]


@router.get("/actions", response_model=List[str])
async def list_known_actions(
    _: dict = Depends(require_role(Role.ADMIN)),
):
    """Return the list of known audit action strings (for filter dropdowns)."""
    return KNOWN_ACTIONS
