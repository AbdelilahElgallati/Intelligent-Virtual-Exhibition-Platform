"""Analytics module router for IVEP."""

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Any, List
from app.modules.events.service import resolve_event_id

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from bson import ObjectId

from app.core.dependencies import get_current_user, require_role, require_roles
from app.modules.auth.enums import Role
from app.db.mongo import get_database
from app.db.utils import _oid_or_value

from .pdf_service import latex_service
from .repository import analytics_repo
from .schemas import AnalyticsEventCreate, AnalyticsEventRead, DashboardData
from .service import (
    build_admin_platform_report,
    build_enterprise_event_report,
    build_organizer_event_report,
    build_organizer_overall_report,
    list_events,
    list_events_persistent,
    log_event,
    log_event_persistent,
    validate_event_report_consistency,
)
from app.modules.stands.service import resolve_stand_id

router = APIRouter(prefix="/metrics", tags=["Analytics"])


async def _assert_event_access_for_organizer(event_id: str, current_user: dict):
    db = get_database()
    event_id = await resolve_event_id(event_id)
    event = await db["events"].find_one({"_id": _oid_or_value(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.get("organizer_id")) != str(current_user.get("_id")):
        raise HTTPException(status_code=403, detail="You are not allowed to access this event analytics")
    # Store slug for filename use
    event["id"] = str(event["_id"])
    return event


async def _assert_stand_access_for_enterprise(stand_id: str, current_user: dict):
    db = get_database()
    stand_id = await resolve_stand_id(stand_id)
    stand = await db["stands"].find_one({"_id": _oid_or_value(stand_id)})
    if not stand:
        raise HTTPException(status_code=404, detail="Stand not found")

    member_doc = await db["organization_members"].find_one({"user_id": str(current_user.get("_id"))})
    if not member_doc or str(member_doc.get("organization_id")) != str(stand.get("organization_id")):
        raise HTTPException(status_code=403, detail="You are not allowed to access this stand analytics")
    # Store slug for filename use
    stand["id"] = str(stand["_id"])
    return stand


@router.post("/log", response_model=AnalyticsEventRead, status_code=status.HTTP_201_CREATED)
async def log_analytics_event(
    data: AnalyticsEventCreate,
    current_user: dict = Depends(get_current_user),
) -> AnalyticsEventRead:
    """Log an analytics event (authenticated users only, persisted)."""
    event_id = await resolve_event_id(data.event_id) if data.event_id else None
    stand_id = await resolve_stand_id(data.stand_id) if data.stand_id else None
    event = await log_event_persistent(
        type=data.type,
        user_id=str(current_user.get("_id")),
        event_id=event_id,
        stand_id=stand_id,
        metadata=data.metadata,
    )
    return AnalyticsEventRead(**event)


@router.get("/", response_model=List[AnalyticsEventRead])
async def get_analytics_events(
    limit: int = Query(100, ge=1, le=1000),
    event_id: str | None = Query(None),
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> List[AnalyticsEventRead]:
    """Get analytics events (Admin or Organizer only)."""
    event_id = await resolve_event_id(event_id) if event_id else None
    events = await list_events_persistent(limit=limit, event_id=event_id)
    if not events:
        events = list_events(limit=limit)
    return [AnalyticsEventRead(**e) for e in events]


@router.get("/stand/{id}", response_model=DashboardData)
async def get_stand_metrics(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    resolved_id = await resolve_stand_id(id)
    role = current_user.get("role")
    if role == Role.ENTERPRISE.value:
        await _assert_stand_access_for_enterprise(resolved_id, current_user)
    return await analytics_repo.get_stand_analytics(resolved_id)


@router.get("/event/{id}", response_model=DashboardData)
async def get_event_metrics(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    resolved_id = await resolve_event_id(id)
    role = current_user.get("role")
    if role == Role.ORGANIZER.value:
        await _assert_event_access_for_organizer(resolved_id, current_user)
    return await analytics_repo.get_event_analytics(resolved_id)


@router.get("/report/export")
async def export_platform_report(
    format: str = Query("pdf", enum=["pdf", "tex", "csv"]),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """Export platform-wide analysis report (Admin only)."""
    report = await build_admin_platform_report()
    return _render_report_export(
        report=report,
        format=format,
        template_name="admin_platform_report",
        filename_base="platform_report",
    )


@router.get("/platform", response_model=DashboardData)
async def get_platform_metrics(
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """Platform-wide KPI aggregation (Admin only)."""
    return await analytics_repo.get_platform_metrics()


def _report_to_latex_data(report: dict[str, Any], title: str, description: str) -> dict[str, Any]:
    if description == "Auto-generated IVEP report.":
        description = (
            "This dossier summarizes platform scale, monetization, and trust \\& safety signals "
            "for executive review. Figures reflect live aggregates at generation time; use the "
            "admin console for interactive drill-down."
        )
    data = {
        "report_title": title,
        "overview_description": description,
        "kpis": [
            {
                "label": item.get("label", "KPI"),
                "value": item.get("value", 0),
                "unit": item.get("unit", ""),
            }
            for item in report.get("kpis", [])
        ],
        "revenue": report.get(
            "revenue",
            {"ticket_revenue": 0.0, "stand_revenue": 0.0, "total_revenue": 0.0},
        ),
        "safety": report.get(
            "safety",
            {"total_flags": 0, "resolved_flags": 0, "resolution_rate": 0.0},
        ),
        "generated_at": report.get("generated_at"),
        # Default currency label for display; templates may use this
        "currency_label": "MAD",
    }
    # Pass-through optional fields when available for richer templates
    for key in (
        "event_id",
        "event_title",
        "enterprises",
        "trend_visitors",
        "key_insights",
        "distribution",
        "recent_activity",
    ):
        if key in report:
            data[key] = report.get(key)
    return data


def _report_to_csv_bytes(report: dict[str, Any]) -> bytes:
    """Tabular export of report KPIs and scalar sections (UTF-8 CSV)."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["section", "field", "value"])
    writer.writerow(["meta", "generated_at", report.get("generated_at", "")])
    for item in report.get("kpis", []) or []:
        writer.writerow(
            [
                "kpi",
                item.get("label", ""),
                item.get("value", ""),
            ]
        )
    rev = report.get("revenue") or {}
    if isinstance(rev, dict):
        for key, val in rev.items():
            writer.writerow(["revenue", key, val])
    safety = report.get("safety") or {}
    if isinstance(safety, dict):
        for key, val in safety.items():
            writer.writerow(["safety", key, val])
    for key in ("event_id", "event_title"):
        if report.get(key) is not None:
            writer.writerow(["context", key, report.get(key)])
    return buffer.getvalue().encode("utf-8-sig")


def _render_report_export(
    report: dict[str, Any],
    format: str,
    template_name: str,
    filename_base: str,
) -> Response | StreamingResponse:
    latex_data = _report_to_latex_data(
        report,
        title=filename_base.replace("_", " ").title(),
        description="Auto-generated IVEP report.",
    )
    if format == "csv":
        raw = _report_to_csv_bytes(report)
        return Response(
            content=raw,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename_base}.csv"',
            },
        )
    if format == "tex":
        html_content = latex_service.generate_html(latex_data, template_name=template_name)
        return Response(
            content=html_content,
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.html"'},
        )

    pdf_bytes = latex_service.generate_report_pdf(latex_data, template_name=template_name)
    if pdf_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF generation failed. Please consult server logs."
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename_base}.pdf"'},
    )


@router.get("/reports/admin/platform")
async def get_admin_platform_report(
    format: str = Query("json", enum=["json", "pdf", "tex", "csv"]),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """Unified admin platform report endpoint."""
    report = await build_admin_platform_report()
    if format == "json":
        return report
    return _render_report_export(
        report=report,
        format=format,
        template_name="admin_platform_report",
        filename_base="admin_platform_report",
    )


@router.get("/reports/organizer/events/{event_id}")
async def get_organizer_event_report(
    event_id: str,
    format: str = Query("json", enum=["json", "pdf", "tex"]),
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    """Organizer event-specific report with export options."""
    resolved_id = await resolve_event_id(event_id)
    try:
        report = await build_organizer_event_report(resolved_id, organizer_user_id=str(current_user["_id"]))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if format == "json":
        return report
    
    # Use slug in filename
    filename_slug = report.get("event_slug") or event_id
    return _render_report_export(
        report=report,
        format=format,
        template_name="organizer_event_report",
        filename_base=f"organizer_event_{filename_slug}",
    )


@router.get("/reports/organizer/overall")
async def get_organizer_overall_report(
    format: str = Query("json", enum=["json", "pdf", "tex"]),
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    """Organizer overall report across all organizer-owned events."""
    report = await build_organizer_overall_report(str(current_user["_id"]))
    if format == "json":
        return report
    return _render_report_export(
        report=report,
        format=format,
        template_name="organizer_overall_report",
        filename_base="organizer_overall_report",
    )


@router.get("/reports/enterprise/events/{event_id}")
async def get_enterprise_event_report(
    event_id: str,
    format: str = Query("json", enum=["json", "pdf", "tex"]),
    current_user: dict = Depends(require_role(Role.ENTERPRISE)),
):
    """Enterprise event report for the authenticated enterprise member."""
    resolved_id = await resolve_event_id(event_id)
    report = await build_enterprise_event_report(resolved_id, str(current_user["_id"]))
    if format == "json":
        return report
    
    filename_slug = report.get("event_slug") or event_id
    return _render_report_export(
        report=report,
        format=format,
        template_name="report",
        filename_base=f"enterprise_event_{filename_slug}",
    )


@router.get("/reports/consistency/{event_id}")
async def get_event_consistency_report(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
):
    """Cross-domain consistency report for a single event."""
    resolved_id = await resolve_event_id(event_id)
    report = await validate_event_report_consistency(resolved_id)
    return report


@router.get("/live/platform")
async def get_live_platform_metrics(
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """Admin live platform analytics with rolling recent activity counters."""
    db = get_database()
    now = datetime.now(timezone.utc)
    since_15m = now - timedelta(minutes=15)

    try:
        base = await analytics_repo.get_platform_metrics()
        live = {
            "active_conferences": await db["conferences"].count_documents({"status": "live"}),
            "live_meetings": await db["meetings"].count_documents({"session_status": "live"}),
            "messages_last_15m": await db["chat_messages"].count_documents({"timestamp": {"$gte": since_15m}}),
            "events_last_15m": await db["analytics_events"].count_documents({"created_at": {"$gte": since_15m}}),
        }
    except Exception as e:
        print(f"ERROR fetching live platform metrics: {e}")
        raise HTTPException(status_code=503, detail="Metrics temporarily unavailable.")

    return {
        "scope": "live_platform",
        "generated_at": now.isoformat(),
        "dashboard": base,
        "live": live,
    }


@router.get("/live/events/{event_id}")
async def get_live_event_metrics(
    event_id: str,
    current_user: dict = Depends(require_roles([Role.ORGANIZER, Role.ADMIN])),
):
    """Organizer/Admin live event analytics with rolling counters."""
    resolved_id = await resolve_event_id(event_id)
    db = get_database()
    role = current_user.get("role")
    if role == Role.ORGANIZER.value:
        await _assert_event_access_for_organizer(resolved_id, current_user)

    now = datetime.now(timezone.utc)
    since_15m = now - timedelta(minutes=15)
    
    try:
        base = await analytics_repo.get_event_analytics(resolved_id)
        live = {
            "active_conferences": await db["conferences"].count_documents({"event_id": str(resolved_id), "status": "live"}),
            "live_meetings": await db["meetings"].count_documents({"event_id": str(resolved_id), "session_status": "live"}),
            "messages_last_15m": await db["chat_messages"].count_documents({"event_id": str(resolved_id), "timestamp": {"$gte": since_15m}}),
            "events_last_15m": await db["analytics_events"].count_documents({"event_id": str(resolved_id), "created_at": {"$gte": since_15m}}),
        }
    except Exception as e:
        print(f"ERROR fetching live event metrics for {resolved_id}: {e}")
        raise HTTPException(status_code=503, detail="Metrics temporarily unavailable.")

    return {
        "scope": "live_event",
        "event_id": str(resolved_id),
        "generated_at": now.isoformat(),
        "dashboard": base,
        "live": live,
    }


@router.get("/live/stands/{stand_id}")
async def get_live_stand_metrics(
    stand_id: str,
    current_user: dict = Depends(require_roles([Role.ENTERPRISE, Role.ADMIN])),
):
    """Enterprise/Admin live stand analytics with rolling counters."""
    resolved_id = await resolve_stand_id(stand_id)
    db = get_database()
    role = current_user.get("role")
    stand = None
    if role == Role.ENTERPRISE.value:
        stand = await _assert_stand_access_for_enterprise(resolved_id, current_user)
    else:
        stand = await db["stands"].find_one({"_id": _oid_or_value(resolved_id)})
        if not stand:
            raise HTTPException(status_code=404, detail="Stand not found")

    event_id = str(stand.get("event_id")) if stand and stand.get("event_id") else None
    now = datetime.now(timezone.utc)
    since_15m = now - timedelta(minutes=15)
    
    try:
        base_metrics = await analytics_repo.get_stand_analytics(resolved_id)
        live = {
            "live_meetings": await db["meetings"].count_documents({"stand_id": str(resolved_id), "session_status": "live"}),
            "messages_last_15m": await db["chat_messages"].count_documents({"event_id": event_id, "timestamp": {"$gte": since_15m}}) if event_id else 0,
            "stand_events_last_15m": await db["analytics_events"].count_documents({"stand_id": str(resolved_id), "created_at": {"$gte": since_15m}}),
            "leads_last_15m": await db["leads"].count_documents({"stand_id": str(resolved_id), "last_interaction": {"$gte": since_15m}}),
        }
    except Exception as e:
        print(f"ERROR fetching live stand metrics for {resolved_id}: {e}")
        raise HTTPException(status_code=503, detail="Metrics temporarily unavailable.")

    return {
        "scope": "live_stand",
        "stand_id": str(resolved_id),
        "event_id": event_id,
        "generated_at": now.isoformat(),
        "dashboard": base_metrics,
        "live": live,
    }
