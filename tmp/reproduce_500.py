import asyncio
import os
import sys
import traceback

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def test_latex_error():
    from app.db.mongo import connect_to_mongo, get_database
    from app.modules.organizer_report.service import get_organizer_summary
    from app.modules.analytics.latex_service import latex_service
    
    # Mock environment variables for settings
    os.environ["JWT_SECRET_KEY"] = "test_secret_key_long_enough_for_validation"
    os.environ["MONGODB_URL"] = "mongodb://localhost:27017"
    
    await connect_to_mongo()
    db = get_database()
    
    # Get a random event
    event = await db["events"].find_one({}, {"_id": 1, "slug": 1, "title": 1})
    if not event:
        print("No events found in DB to test.")
        return

    event_id = str(event["_id"])
    print(f"Testing PDF generation for event: {event.get('slug')} (ID: {event_id})")
    
    try:
        summary = await get_organizer_summary(event_id)
        
        # Prepare data like the router does
        event_slug = summary.event_slug or event_id
        event_display_name = summary.event_title or event_slug
        data = {
            "event_id": str(summary.event_id),
            "report_title": f"Event Performance: {event_display_name}",
            "overview_description": f"Detailed performance metrics for event {event_display_name}.",
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
        
        print("Starting PDF generation...")
        pdf_bytes = latex_service.generate_report_pdf(data, template_name="organizer_event_report")
        print(f"PDF generation successful! Size: {len(pdf_bytes)} bytes")
        
    except Exception:
        print("ERROR during PDF generation:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_latex_error())
