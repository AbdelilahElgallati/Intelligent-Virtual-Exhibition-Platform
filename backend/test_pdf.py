import sys
import os
from datetime import datetime, timezone

# Add backend to path
sys.path.append(r"d:\My_Projects\Intelligent-Virtual-Exhibition-Platform\backend")

from app.modules.analytics.pdf_service import pdf_service

data = {
    "report_title": "Platform Growth Dashboard",
    "overview_description": "Total active users have increased by 24% this month, driven by the Spring Expo event.",
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    "currency_label": "MAD",
    "kpis": [
        {"label": "Total Visitors", "value": 12450, "unit": ""},
        {"label": "Active Events", "value": 12, "unit": ""},
        {"label": "Leads Captured", "value": 342, "unit": ""},
        {"label": "Meetings Held", "value": 89, "unit": ""},
        {"label": "Revenue", "value": 45000, "unit": "MAD"},
    ],
    "revenue": {
        "ticket_revenue": 30000.0,
        "stand_revenue": 15000.0,
        "total_revenue": 45000.0,
        "paid_transactions": 150
    },
    "safety": {
        "total_flags": 5,
        "resolved_flags": 4,
        "resolution_rate": 80.0
    },
    "distribution": {
        "active": 8,
        "pending": 3,
        "ended": 1
    }
}

pdf_bytes = pdf_service.generate_report_pdf(data, "admin_platform_report")

with open("test_report.pdf", "wb") as f:
    f.write(pdf_bytes)

print(f"PDF generated: {os.path.abspath('test_report.pdf')}")
