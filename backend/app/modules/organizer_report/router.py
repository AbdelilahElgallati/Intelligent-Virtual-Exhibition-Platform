"""
Organizer Report Router — Week 6.

Endpoints:
  GET  /admin/events/{event_id}/organizer-summary       → JSON report
  GET  /admin/events/{event_id}/organizer-summary/pdf   → PDF download
"""
from __future__ import annotations

import io
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.dependencies import get_current_user, require_role
from app.modules.auth.enums import Role
from app.modules.organizer_report.schemas import OrganizerSummaryResponse
from app.modules.organizer_report.service import get_organizer_summary, get_organizer_overall_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["organizer-report"])
_admin = Depends(require_role(Role.ADMIN))



# ─── JSON summary ─────────────────────────────────────────────────────────────

@router.get(
    "/admin/events/{event_id}/organizer-summary",
    response_model=OrganizerSummaryResponse,
    summary="Get organizer business-intelligence report for an event",
)
async def organizer_summary(
    event_id: str,
    _admin=Depends(require_role(Role.ADMIN)),
):
    try:
        return await get_organizer_summary(event_id)
    except Exception as exc:
        logger.exception("organizer_summary error for event %s: %s", event_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate organizer summary.",
        ) from exc


# ─── PDF export ───────────────────────────────────────────────────────────────

def _build_pdf(summary: OrganizerSummaryResponse, event_id: str) -> bytes:
    """
    Build a simple PDF using reportlab if available,
    falling back to an RFC-3986 plain-text stub otherwise.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib import colors

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm)
        styles = getSampleStyleSheet()
        story = []

        # Title
        story.append(Paragraph(f"Organizer Report — Event {event_id}", styles["Title"]))
        story.append(Paragraph(f"Generated: {summary.generated_at.strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
        story.append(Spacer(1, 0.5 * cm))

        # Overview KPIs
        story.append(Paragraph("Overview", styles["Heading2"]))
        ov = summary.overview
        kpi_data = [
            ["Metric", "Value"],
            ["Total Visitors", str(ov.total_visitors)],
            ["Enterprise Participation Rate", f"{ov.enterprise_participation_rate:.1f}%"],
            ["Stand Engagement Score", f"{ov.stand_engagement_score:.1f} / 100"],
            ["Leads Generated", str(ov.leads_generated)],
            ["Meetings Booked", str(ov.meetings_booked)],
            ["Chat Interactions", str(ov.chat_interactions)],
        ]
        tbl = Table(kpi_data, hAlign="LEFT")
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6d28d9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f3ff")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 0.5 * cm))

        # Revenue
        story.append(Paragraph("Revenue", styles["Heading2"]))
        rv = ov.revenue_summary
        rev_data = [
            ["Category", "Amount (USD)"],
            ["Ticket Revenue", f"${rv.ticket_revenue:,.2f}"],
            ["Stand Revenue", f"${rv.stand_revenue:,.2f}"],
            ["Total Revenue", f"${rv.total_revenue:,.2f}"],
        ]
        rtbl = Table(rev_data, hAlign="LEFT")
        rtbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#ecfdf5")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1fae5")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(rtbl)
        story.append(Spacer(1, 0.5 * cm))

        # Safety
        story.append(Paragraph("Safety & Moderation", styles["Heading2"]))
        sf = summary.safety
        safe_data = [
            ["Metric", "Value"],
            ["Total Flags", str(sf.total_flags)],
            ["Resolved Flags", str(sf.resolved_flags)],
            ["Resolution Rate", f"{sf.resolution_rate:.1f}%"],
        ]
        stbl = Table(safe_data, hAlign="LEFT")
        stbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dc2626")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fef2f2")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fecaca")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(stbl)

        doc.build(story)
        return buf.getvalue()

    except ImportError:
        # reportlab not installed — return a plain-text PDF stub
        lines = [
            f"Organizer Report — Event {event_id}",
            f"Generated: {summary.generated_at.strftime('%Y-%m-%d %H:%M UTC')}",
            "",
            "== Overview ==",
            f"Total Visitors: {summary.overview.total_visitors}",
            f"Enterprise Rate: {summary.overview.enterprise_participation_rate:.1f}%",
            f"Engagement Score: {summary.overview.stand_engagement_score:.1f}/100",
            f"Leads: {summary.overview.leads_generated}",
            f"Meetings: {summary.overview.meetings_booked}",
            f"Chat: {summary.overview.chat_interactions}",
            "",
            "== Revenue ==",
            f"Ticket: ${summary.overview.revenue_summary.ticket_revenue:,.2f}",
            f"Stand:  ${summary.overview.revenue_summary.stand_revenue:,.2f}",
            f"Total:  ${summary.overview.revenue_summary.total_revenue:,.2f}",
            "",
            "== Safety ==",
            f"Flags: {summary.safety.total_flags}",
            f"Resolved: {summary.safety.resolved_flags}",
            f"Rate: {summary.safety.resolution_rate:.1f}%",
        ]
        return "\n".join(lines).encode("utf-8")


@router.get(
    "/organizer/events/{event_id}/report",
    summary="Download event-specific report for organizer",
)
async def organizer_event_report(
    event_id: str,
    format: str = Query("pdf", enum=["pdf", "tex"]),
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    """Event-specific LaTeX report for organizers."""
    summary = await get_organizer_summary(event_id)
    
    # Prepare data for LaTeX
    data = {
        "report_title": f"Event Performance: {event_id}",
        "overview_description": f"Detailed performance metrics for event {event_id}, including visitor engagement and revenue analysis.",
        "kpis": [
            {"label": "Total Visitors", "value": summary.overview.total_visitors},
            {"label": "Enterprise Rate", "value": summary.overview.enterprise_participation_rate, "unit": "%"},
            {"label": "Engagement Score", "value": summary.overview.stand_engagement_score, "unit": "/ 100"},
            {"label": "Leads", "value": summary.overview.leads_generated},
            {"label": "Meetings", "value": summary.overview.meetings_booked},
            {"label": "Chat Messages", "value": summary.overview.chat_interactions},
        ],
        "revenue": {
            "ticket_revenue": summary.overview.revenue_summary.ticket_revenue,
            "stand_revenue": summary.overview.revenue_summary.stand_revenue,
            "total_revenue": summary.overview.revenue_summary.total_revenue,
        },
        "safety": {
            "total_flags": summary.safety.total_flags,
            "resolved_flags": summary.safety.resolved_flags,
            "resolution_rate": summary.safety.resolution_rate,
        }
    }

    from app.modules.analytics.latex_service import latex_service
    from fastapi.responses import Response, StreamingResponse
    import io

    if format == "tex":
        tex_content = latex_service.generate_tex(data)
        return Response(
            content=tex_content,
            media_type="application/x-tex",
            headers={"Content-Disposition": f'attachment; filename="event_{event_id}_report.tex"'}
        )
    
    pdf_bytes = latex_service.generate_report_pdf(data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="event_{event_id}_report.pdf"'}
    )


@router.get(
    "/admin/events/{event_id}/organizer-summary/pdf",
    summary="Download organizer report as PDF",
    response_class=StreamingResponse,
)
async def organizer_summary_pdf(
    event_id: str,
    _admin=Depends(require_role(Role.ADMIN)),
):
    try:
        summary = await get_organizer_summary(event_id)
        
        # Prepare data for LaTeX
        data = {
            "report_title": f"Organizer Summary: Event {event_id}",
            "overview_description": f"Summary report generated for administration review regarding event {event_id}.",
            "kpis": [
                {"label": "Total Visitors", "value": summary.overview.total_visitors},
                {"label": "Leads", "value": summary.overview.leads_generated},
                {"label": "Meetings", "value": summary.overview.meetings_booked},
            ],
            "revenue": {
                "ticket_revenue": summary.overview.revenue_summary.ticket_revenue,
                "stand_revenue": summary.overview.revenue_summary.stand_revenue,
                "total_revenue": summary.overview.revenue_summary.total_revenue,
            },
            "safety": {
                "total_flags": summary.safety.total_flags,
                "resolved_flags": summary.safety.resolved_flags,
                "resolution_rate": summary.safety.resolution_rate,
            }
        }

        from app.modules.analytics.latex_service import latex_service
        pdf_bytes = latex_service.generate_report_pdf(data)
        
        filename = f"organizer_report_{event_id}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF export endpoint error for event %s: %s", event_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(exc)}",
        ) from exc


@router.get(
    "/organizer/overall-summary",
    response_model=OrganizerSummaryResponse,
    summary="Get overall performance summary for all events owned by the organizer",
)
async def organizer_overall_summary(
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    try:
        return await get_organizer_overall_summary(str(current_user["_id"]))
    except Exception as exc:
        logger.exception("organizer_overall_summary error for organizer %s: %s", current_user["_id"], exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate overall performance summary.",
        ) from exc


@router.get(
    "/organizer/overall-summary/pdf",
    summary="Download overall performance report as PDF",
)
async def organizer_overall_summary_pdf(
    current_user: dict = Depends(require_role(Role.ORGANIZER)),
):
    try:
        summary = await get_organizer_overall_summary(str(current_user["_id"]))
        
        # Prepare data for LaTeX
        data = {
            "report_title": "Overall Organizer Performance",
            "overview_description": "Aggregate performance report for all your events on the IVEP platform.",
            "kpis": [
                {"label": "Total Visitors", "value": summary.overview.total_visitors},
                {"label": "Leads Generated", "value": summary.overview.leads_generated},
                {"label": "Meetings Booked", "value": summary.overview.meetings_booked},
                {"label": "Chat Interactions", "value": summary.overview.chat_interactions},
            ],
            "revenue": {
                "ticket_revenue": summary.overview.revenue_summary.ticket_revenue,
                "stand_revenue": summary.overview.revenue_summary.stand_revenue,
                "total_revenue": summary.overview.revenue_summary.total_revenue,
            },
            "safety": {
                "total_flags": summary.safety.total_flags,
                "resolved_flags": summary.safety.resolved_flags,
                "resolution_rate": summary.safety.resolution_rate,
            }
        }

        from app.modules.analytics.latex_service import latex_service
        pdf_bytes = latex_service.generate_report_pdf(data)
        
        filename = f"overall_performance_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        logger.exception("Overall PDF export error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate overall report: {str(exc)}",
        ) from exc


def _build_pdf_fallback_text(summary: OrganizerSummaryResponse, event_id: str) -> bytes:
    lines = [
        f"Organizer Report — Event {event_id}",
        f"Generated: {summary.generated_at.strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "== Overview ==",
        f"Total Visitors: {summary.overview.total_visitors}",
        f"Enterprise Rate: {summary.overview.enterprise_participation_rate:.1f}%",
        f"Engagement Score: {summary.overview.stand_engagement_score:.1f}/100",
        f"Leads: {summary.overview.leads_generated}",
        f"Meetings: {summary.overview.meetings_booked}",
        f"Chat: {summary.overview.chat_interactions}",
        "",
        "== Revenue ==",
        f"Ticket: ${summary.overview.revenue_summary.ticket_revenue:,.2f}",
        f"Stand:  ${summary.overview.revenue_summary.stand_revenue:,.2f}",
        f"Total:  ${summary.overview.revenue_summary.total_revenue:,.2f}",
        "",
        "== Safety ==",
        f"Flags: {summary.safety.total_flags}",
        f"Resolved: {summary.safety.resolved_flags}",
        f"Rate: {summary.safety.resolution_rate:.1f}%",
    ]
    return "\n".join(lines).encode("utf-8")
