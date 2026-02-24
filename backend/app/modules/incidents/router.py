"""
Incidents router — CRUD for incidents + content flagging (Admin only).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List

from app.core.dependencies import require_role, get_current_user
from app.modules.auth.enums import Role

from .schemas import (
    IncidentCreate, IncidentUpdate, IncidentRead,
    ContentFlagCreate, ContentFlagRead,
)
from .service import (
    create_incident, list_incidents, get_incident, update_incident,
    create_flag, list_flags,
)
from app.modules.audit.service import log_audit

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.post("/", response_model=IncidentRead, status_code=status.HTTP_201_CREATED)
async def new_incident(
    data: IncidentCreate,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """Create a new incident record (Admin only)."""
    incident = await create_incident(
        title=data.title,
        description=data.description,
        severity=data.severity,
    )
    await log_audit(
        actor_id=str(current_user.get("_id", "")),
        action="incident.create",
        entity="incident",
        entity_id=incident["id"],
        metadata={"title": data.title, "severity": data.severity.value},
    )
    return IncidentRead(**incident)


@router.get("/", response_model=List[IncidentRead])
async def get_incidents(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    """List incidents (Admin only)."""
    incidents = await list_incidents(status=status, limit=limit, skip=skip)
    return [IncidentRead(**i) for i in incidents]


@router.patch("/{incident_id}", response_model=IncidentRead)
async def patch_incident(
    incident_id: str,
    data: IncidentUpdate,
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """Update an incident's status, severity, or notes (Admin only)."""
    updates = data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    # Serialize enums
    for k in ("status", "severity"):
        if k in updates and hasattr(updates[k], "value"):
            updates[k] = updates[k].value

    incident = await update_incident(incident_id, updates)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    await log_audit(
        actor_id=str(current_user.get("_id", "")),
        action="incident.update",
        entity="incident",
        entity_id=incident_id,
        metadata=updates,
    )
    return IncidentRead(**incident)


@router.post("/flag", response_model=ContentFlagRead, status_code=status.HTTP_201_CREATED)
async def flag_content(
    data: ContentFlagCreate,
    current_user: dict = Depends(get_current_user),
):
    """Flag content (any authenticated user can flag)."""
    flag = await create_flag(
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        reason=data.reason,
        details=data.details,
        reporter_id=str(current_user.get("_id", "")),
    )
    return ContentFlagRead(**flag)


@router.get("/flags", response_model=List[ContentFlagRead])
async def get_flags(
    limit: int = Query(50, ge=1, le=200),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    """List content flags (Admin only)."""
    flags = await list_flags(limit=limit)
    return [ContentFlagRead(**f) for f in flags]
