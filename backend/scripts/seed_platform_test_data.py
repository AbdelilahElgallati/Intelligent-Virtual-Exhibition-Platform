from __future__ import annotations

import asyncio
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from app.core.security import get_password_hash
from app.db.mongo import close_mongo_connection, connect_to_mongo, get_database
from app.modules.analytics.schemas import AnalyticsEventType
from app.modules.analytics.service import log_event_persistent
from app.modules.auth.enums import Role
from app.modules.chat.repository import chat_repo
from app.modules.conferences.repository import conf_repo
from app.modules.enterprise.repository import enterprise_repo
from app.modules.enterprise.schemas import ProductCreate
from app.modules.events.schemas import EventCreate, EventState, ScheduleDay, ScheduleSlot
from app.modules.events.service import create_event
from app.modules.leads.schemas import LeadInteraction
from app.modules.leads.service import lead_service
from app.modules.marketplace import service as marketplace_service
from app.modules.meetings.repository import meeting_repo
from app.modules.meetings.schemas import MeetingCreate, MeetingType, MeetingUpdate, MeetingStatus
from app.modules.organizations.schemas import OrganizationCreate, OrgMemberRole
from app.modules.organizations.service import add_organization_member, create_organization
from app.modules.payments.service import create_payment, mark_payment_paid
from app.modules.resources.repository import resource_repo
from app.modules.resources.schemas import ResourceCreate, ResourceType
from app.modules.stands.service import create_stand, get_stand_by_org, update_stand
from app.modules.users.service import create_user, get_user_by_email


SEED_PASSWORD = "Password123!"
NOW = datetime.now(timezone.utc)


@dataclass
class SeedSummary:
    users_created: int = 0
    users_updated: int = 0
    organizations_created: int = 0
    organizations_updated: int = 0
    events_created: int = 0
    events_updated: int = 0
    participants_created: int = 0
    participants_updated: int = 0
    stands_created: int = 0
    stands_updated: int = 0
    resources_created: int = 0
    enterprise_products_created: int = 0
    marketplace_products_created: int = 0
    product_requests_created: int = 0
    stand_orders_created: int = 0
    meetings_created: int = 0
    chat_rooms_created: int = 0
    chat_messages_created: int = 0
    conferences_created: int = 0
    conference_registrations_created: int = 0
    analytics_events_created: int = 0
    payments_created: int = 0
    content_flags_created: int = 0
    notes: list[str] = field(default_factory=list)


def _serialize_schedule(day_specs: list[dict[str, Any]]) -> tuple[str, list[ScheduleDay]]:
    schedule_days: list[ScheduleDay] = []
    json_ready: list[dict[str, Any]] = []
    for day_spec in day_specs:
        slots = [ScheduleSlot(**slot_spec) for slot_spec in day_spec["slots"]]
        schedule_days.append(
            ScheduleDay(
                day_number=day_spec["day_number"],
                date_label=day_spec.get("date_label"),
                slots=slots,
            )
        )
        json_ready.append(
            {
                "day_number": day_spec["day_number"],
                "date_label": day_spec.get("date_label"),
                "slots": [slot.model_dump() for slot in slots],
            }
        )
    return json.dumps(json_ready), schedule_days


def _event_blueprints() -> list[dict[str, Any]]:
    return [
        {
            "key": "future-tech-live",
            "title": "FutureTech Global Expo 2026",
            "organizer_email": "organizer.amine@ivep.test",
            "organizer_name": "Amine El Idrissi",
            "description": "A live multi-day technology exhibition focused on AI, cloud platforms, robotics, and enterprise tooling.",
            "category": "Technology",
            "location": "IVEP Virtual Arena",
            "banner_url": "/stands/office-bg.jpg",
            "tags": ["ai", "cloud", "robotics"],
            "num_enterprises": 5,
            "stand_price": 4500.0,
            "is_paid": True,
            "ticket_price": 79.0,
            "state": EventState.LIVE.value,
            "payment_amount": 13500.0,
            "created_at": NOW - timedelta(days=16),
            "start_date": NOW - timedelta(days=1),
            "end_date": NOW + timedelta(days=5),
            "enterprise_link": "https://ivep.local/future-tech-2026/enterprise",
            "visitor_link": "https://ivep.local/future-tech-2026/visitor",
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW - timedelta(days=1)).date().isoformat(),
                    "slots": [
                        {"start_time": "09:00", "end_time": "10:30", "label": "Opening keynote"},
                        {"start_time": "11:00", "end_time": "12:30", "label": "AI product showcases"},
                        {"start_time": "14:00", "end_time": "16:00", "label": "B2B networking sprint"},
                    ],
                },
                {
                    "day_number": 2,
                    "date_label": NOW.date().isoformat(),
                    "slots": [
                        {"start_time": "09:30", "end_time": "11:00", "label": "Enterprise innovation conference", "is_conference": True},
                        {"start_time": "11:30", "end_time": "13:00", "label": "Stand demos"},
                        {"start_time": "15:00", "end_time": "23:59", "label": "Investor meetings"},
                    ],
                },
                {
                    "day_number": 3,
                    "date_label": (NOW + timedelta(days=1)).date().isoformat(),
                    "slots": [
                        {"start_time": "09:00", "end_time": "23:59", "label": "Always-on demo and networking day"},
                    ],
                },
            ],
            "extended_details": "Live event seeded for end-to-end organizer, enterprise, admin, visitor, conferencing, meetings, payments, and analytics testing.",
            "additional_info": "Includes live chat rooms, active meetings, product requests, and rolling analytics events.",
        },
        {
            "key": "green-summit-payment-done",
            "title": "Green Industry Summit 2026",
            "organizer_email": "organizer.salma@ivep.test",
            "organizer_name": "Salma Benyoussef",
            "description": "A fully approved sustainability summit ready for operations, exhibitor management, and visitor onboarding.",
            "category": "Sustainability",
            "location": "IVEP Green Campus",
            "banner_url": "/stands/office-stand.jpeg",
            "tags": ["sustainability", "climate", "industry"],
            "num_enterprises": 4,
            "stand_price": 3200.0,
            "is_paid": False,
            "ticket_price": None,
            "state": EventState.PAYMENT_DONE.value,
            "payment_amount": 9600.0,
            "created_at": NOW - timedelta(days=24),
            "start_date": NOW + timedelta(days=5),
            "end_date": NOW + timedelta(days=7),
            "enterprise_link": "https://ivep.local/green-industry-2026/enterprise",
            "visitor_link": "https://ivep.local/green-industry-2026/visitor",
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW + timedelta(days=5)).date().isoformat(),
                    "slots": [
                        {"start_time": "09:00", "end_time": "10:00", "label": "Welcome session"},
                        {"start_time": "10:30", "end_time": "12:00", "label": "Circular economy forum", "is_conference": True},
                        {"start_time": "14:00", "end_time": "16:00", "label": "Enterprise matchmaking"},
                    ],
                }
            ],
            "extended_details": "Approved and paid organizer event for testing enterprise joins, stand approval workflows, and scheduled operations.",
            "additional_info": "Contains pending payment and pending admin approval enterprise scenarios.",
        },
        {
            "key": "marketplace-closed",
            "title": "Marketplace Growth Forum 2025",
            "organizer_email": "organizer.amine@ivep.test",
            "organizer_name": "Amine El Idrissi",
            "description": "A completed commercial event with historical activity for analytics and reporting validation.",
            "category": "Commerce",
            "location": "IVEP Commerce Hall",
            "banner_url": "/stands/office-bg.jpg",
            "tags": ["marketplace", "commerce", "growth"],
            "num_enterprises": 3,
            "stand_price": 2800.0,
            "is_paid": True,
            "ticket_price": 39.0,
            "state": EventState.CLOSED.value,
            "payment_amount": 5600.0,
            "created_at": NOW - timedelta(days=80),
            "start_date": NOW - timedelta(days=45),
            "end_date": NOW - timedelta(days=43),
            "enterprise_link": "https://ivep.local/marketplace-growth-2025/enterprise",
            "visitor_link": "https://ivep.local/marketplace-growth-2025/visitor",
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW - timedelta(days=45)).date().isoformat(),
                    "slots": [
                        {"start_time": "10:00", "end_time": "11:30", "label": "Growth keynote"},
                        {"start_time": "12:00", "end_time": "14:00", "label": "Marketplace demos"},
                    ],
                }
            ],
            "extended_details": "Closed event with past meetings, chats, orders, and analytics for historical dashboards and exports.",
            "additional_info": "Useful for verifying organizer report exports and admin trend charts.",
        },
        {
            "key": "ops-expo-pending",
            "title": "Operational Excellence Expo 2026",
            "organizer_email": "organizer.salma@ivep.test",
            "organizer_name": "Salma Benyoussef",
            "description": "A newly created organizer request waiting for admin approval.",
            "category": "Operations",
            "location": "IVEP Request Queue",
            "banner_url": "/stands/office-bg.jpg",
            "tags": ["operations", "process", "automation"],
            "num_enterprises": 2,
            "stand_price": 2500.0,
            "is_paid": False,
            "ticket_price": None,
            "state": EventState.PENDING_APPROVAL.value,
            "payment_amount": None,
            "created_at": NOW - timedelta(days=2),
            "start_date": NOW + timedelta(days=18),
            "end_date": NOW + timedelta(days=19),
            "enterprise_link": None,
            "visitor_link": None,
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW + timedelta(days=18)).date().isoformat(),
                    "slots": [
                        {"start_time": "10:00", "end_time": "12:00", "label": "Operations planning"},
                        {"start_time": "13:00", "end_time": "15:00", "label": "Workflow demos"},
                    ],
                }
            ],
            "extended_details": "Pending admin approval event request to exercise the admin moderation queue.",
            "additional_info": "No participants yet by design.",
        },
        {
            "key": "finops-approved",
            "title": "FinOps Acceleration Expo 2026",
            "organizer_email": "organizer.amine@ivep.test",
            "organizer_name": "Amine El Idrissi",
            "description": "Admin-approved event open for enterprise join requests before organizer payment handoff.",
            "category": "Finance",
            "location": "IVEP Finance Hub",
            "banner_url": "/stands/office-stand.jpeg",
            "tags": ["finops", "cloud-cost", "efficiency"],
            "num_enterprises": 3,
            "stand_price": 3000.0,
            "is_paid": False,
            "ticket_price": None,
            "state": EventState.APPROVED.value,
            "payment_amount": None,
            "created_at": NOW - timedelta(days=6),
            "start_date": NOW + timedelta(days=12),
            "end_date": NOW + timedelta(days=13),
            "enterprise_link": None,
            "visitor_link": None,
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW + timedelta(days=12)).date().isoformat(),
                    "slots": [
                        {"start_time": "09:00", "end_time": "11:00", "label": "Cloud cost governance"},
                        {"start_time": "11:30", "end_time": "13:00", "label": "FinOps workshops"},
                    ],
                }
            ],
            "extended_details": "Approved event specifically seeded to test enterprise join-request lifecycle before payment completion.",
            "additional_info": "Contains pending admin approval and pending payment enterprise participants.",
        },
        {
            "key": "smart-factory-waiting-payment",
            "title": "Smart Factory Connect 2026",
            "organizer_email": "organizer.salma@ivep.test",
            "organizer_name": "Salma Benyoussef",
            "description": "Organizer-approved event waiting for organizer payment confirmation.",
            "category": "Industry 4.0",
            "location": "IVEP Industrial Pavilion",
            "banner_url": "/stands/office-bg.jpg",
            "tags": ["industry4.0", "iot", "automation"],
            "num_enterprises": 4,
            "stand_price": 3600.0,
            "is_paid": True,
            "ticket_price": 49.0,
            "state": EventState.WAITING_FOR_PAYMENT.value,
            "payment_amount": 10800.0,
            "created_at": NOW - timedelta(days=10),
            "start_date": NOW + timedelta(days=15),
            "end_date": NOW + timedelta(days=17),
            "enterprise_link": None,
            "visitor_link": None,
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW + timedelta(days=15)).date().isoformat(),
                    "slots": [
                        {"start_time": "10:00", "end_time": "12:00", "label": "Factory digitization roadmap"},
                        {"start_time": "14:00", "end_time": "16:00", "label": "Automation pilots"},
                    ],
                }
            ],
            "extended_details": "Waiting-for-payment state event for organizer payment verification and admin monitoring.",
            "additional_info": "No active enterprise participation by design until lifecycle progresses.",
        },
        {
            "key": "creative-week-payment-proof",
            "title": "Creative Media Week 2026",
            "organizer_email": "organizer.salma@ivep.test",
            "organizer_name": "Salma Benyoussef",
            "description": "Organizer payment proof submitted event awaiting admin payment validation.",
            "category": "Media",
            "location": "IVEP Creator Arena",
            "banner_url": "/stands/office-stand.jpeg",
            "tags": ["media", "creator", "production"],
            "num_enterprises": 3,
            "stand_price": 2900.0,
            "is_paid": False,
            "ticket_price": None,
            "state": EventState.PAYMENT_PROOF_SUBMITTED.value,
            "payment_amount": 8700.0,
            "created_at": NOW - timedelta(days=8),
            "start_date": NOW + timedelta(days=20),
            "end_date": NOW + timedelta(days=21),
            "enterprise_link": None,
            "visitor_link": None,
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW + timedelta(days=20)).date().isoformat(),
                    "slots": [
                        {"start_time": "10:00", "end_time": "11:30", "label": "Creator economy keynote"},
                        {"start_time": "12:00", "end_time": "14:00", "label": "Media partner demos"},
                    ],
                }
            ],
            "extended_details": "Payment-proof-submitted event for admin validation and organizer communication testing.",
            "additional_info": "Useful for admin queue filtering by lifecycle state.",
        },
        {
            "key": "legacy-risk-rejected",
            "title": "Legacy Risk Forum 2026",
            "organizer_email": "organizer.amine@ivep.test",
            "organizer_name": "Amine El Idrissi",
            "description": "Rejected event request with reason for organizer feedback workflows.",
            "category": "Risk",
            "location": "IVEP Compliance Wing",
            "banner_url": "/stands/office-bg.jpg",
            "tags": ["risk", "compliance", "legacy"],
            "num_enterprises": 2,
            "stand_price": 2100.0,
            "is_paid": False,
            "ticket_price": None,
            "state": EventState.REJECTED.value,
            "payment_amount": None,
            "created_at": NOW - timedelta(days=5),
            "start_date": NOW + timedelta(days=25),
            "end_date": NOW + timedelta(days=26),
            "enterprise_link": None,
            "visitor_link": None,
            "day_specs": [
                {
                    "day_number": 1,
                    "date_label": (NOW + timedelta(days=25)).date().isoformat(),
                    "slots": [
                        {"start_time": "09:30", "end_time": "11:00", "label": "Risk review"},
                        {"start_time": "11:30", "end_time": "13:00", "label": "Compliance clinics"},
                    ],
                }
            ],
            "extended_details": "Rejected organizer request used to validate rejection reason and organizer-side messaging.",
            "additional_info": "Should remain inaccessible in enterprise discovery flows.",
        },
    ]


USER_BLUEPRINTS: list[dict[str, Any]] = [
    {
        "email": "admin.root@ivep.test",
        "full_name": "Platform Admin",
        "role": Role.ADMIN.value,
        "bio": "Primary admin account for moderation, payments, analytics, and platform oversight.",
        "title": "Platform Administrator",
        "company": "IVEP Core",
        "interests": ["moderation", "analytics", "operations"],
        "networking_goals": ["platform governance"],
    },
    {
        "email": "organizer.amine@ivep.test",
        "full_name": "Amine El Idrissi",
        "role": Role.ORGANIZER.value,
        "bio": "Organizer focused on large technology and commerce exhibitions.",
        "title": "Senior Event Organizer",
        "company": "IVEP Events Studio",
        "interests": ["events", "technology", "growth"],
        "networking_goals": ["enterprise partnerships", "speaker sourcing"],
    },
    {
        "email": "organizer.salma@ivep.test",
        "full_name": "Salma Benyoussef",
        "role": Role.ORGANIZER.value,
        "bio": "Organizer focused on sustainability and operations programs.",
        "title": "Program Director",
        "company": "IVEP Events Studio",
        "interests": ["sustainability", "operations", "community"],
        "networking_goals": ["sponsors", "enterprise onboarding"],
    },
    {
        "email": "enterprise.novasync@ivep.test",
        "full_name": "Yassine Haddad",
        "role": Role.ENTERPRISE.value,
        "bio": "Enterprise lead for cloud and AI integrations.",
        "title": "Innovation Lead",
        "company": "NovaSync Labs",
        "interests": ["cloud", "ai", "automation"],
        "networking_goals": ["lead generation", "strategic meetings"],
    },
    {
        "email": "enterprise.ecopulse@ivep.test",
        "full_name": "Lina Ait Omar",
        "role": Role.ENTERPRISE.value,
        "bio": "Enterprise lead for clean-tech systems and sustainability reporting.",
        "title": "Business Director",
        "company": "EcoPulse Systems",
        "interests": ["sustainability", "iot", "reporting"],
        "networking_goals": ["channel partners", "enterprise sales"],
    },
    {
        "email": "enterprise.databridge@ivep.test",
        "full_name": "Karim Boussouf",
        "role": Role.ENTERPRISE.value,
        "bio": "Enterprise lead for data pipelines and analytics products.",
        "title": "Solutions Architect",
        "company": "DataBridge Analytics",
        "interests": ["data", "analytics", "dashboards"],
        "networking_goals": ["b2b meetings", "customer discovery"],
    },
    {
        "email": "enterprise.mediasphere@ivep.test",
        "full_name": "Sara Mernissi",
        "role": Role.ENTERPRISE.value,
        "bio": "Enterprise lead for immersive media, conference streaming, and branded content.",
        "title": "Partnership Manager",
        "company": "MediaSphere XR",
        "interests": ["streaming", "content", "immersive"],
        "networking_goals": ["demo bookings", "live sessions"],
    },
    {
        "email": "enterprise.logiflow@ivep.test",
        "full_name": "Omar Tazi",
        "role": Role.ENTERPRISE.value,
        "bio": "Enterprise lead for operational logistics and workflow automation.",
        "title": "Operations Consultant",
        "company": "LogiFlow Automation",
        "interests": ["operations", "workflow", "erp"],
        "networking_goals": ["procurement", "operations leaders"],
    },
]


for index in range(1, 11):
    USER_BLUEPRINTS.append(
        {
            "email": f"visitor{index:02d}@ivep.test",
            "full_name": f"Visitor {index:02d}",
            "role": Role.VISITOR.value,
            "bio": "Visitor profile seeded for networking, stand exploration, meetings, and product requests.",
            "title": "Visitor",
            "company": f"Prospect Company {index:02d}",
            "phone": f"+212600000{index:03d}",
            "city": "Casablanca" if index % 2 == 0 else "Rabat",
            "country": "Morocco",
            "interests": ["innovation", "networking", "products"],
            "networking_goals": ["discover suppliers", "book demos"],
        }
    )


ORGANIZATION_BLUEPRINTS: list[dict[str, Any]] = [
    {
        "name": "NovaSync Labs",
        "owner_email": "enterprise.novasync@ivep.test",
        "description": "Cloud-native AI automation and integration services.",
        "industry": "Artificial Intelligence",
        "website": "https://novasync.example.com",
        "logo_url": "/enterprise_profile/novasync-logo.png",
        "contact_email": "contact@novasync.example.com",
        "is_verified": True,
        "theme_color": "#0f766e",
    },
    {
        "name": "EcoPulse Systems",
        "owner_email": "enterprise.ecopulse@ivep.test",
        "description": "Sustainability monitoring, carbon intelligence, and clean-tech operations.",
        "industry": "Sustainability",
        "website": "https://ecopulse.example.com",
        "logo_url": "/enterprise_profile/ecopulse-logo.png",
        "contact_email": "hello@ecopulse.example.com",
        "is_verified": True,
        "theme_color": "#15803d",
    },
    {
        "name": "DataBridge Analytics",
        "owner_email": "enterprise.databridge@ivep.test",
        "description": "Operational dashboards, governed data pipelines, and BI delivery.",
        "industry": "Data & Analytics",
        "website": "https://databridge.example.com",
        "logo_url": "/enterprise_profile/databridge-logo.png",
        "contact_email": "sales@databridge.example.com",
        "is_verified": True,
        "theme_color": "#1d4ed8",
    },
    {
        "name": "MediaSphere XR",
        "owner_email": "enterprise.mediasphere@ivep.test",
        "description": "Immersive media production, event streaming, and virtual stage experiences.",
        "industry": "Media Technology",
        "website": "https://mediasphere.example.com",
        "logo_url": "/enterprise_profile/mediasphere-logo.png",
        "contact_email": "studio@mediasphere.example.com",
        "is_verified": False,
        "theme_color": "#7c3aed",
    },
    {
        "name": "LogiFlow Automation",
        "owner_email": "enterprise.logiflow@ivep.test",
        "description": "Workflow orchestration, procurement automation, and operational excellence tooling.",
        "industry": "Operations",
        "website": "https://logiflow.example.com",
        "logo_url": "/enterprise_profile/logiflow-logo.png",
        "contact_email": "ops@logiflow.example.com",
        "is_verified": False,
        "theme_color": "#b45309",
    },
]


ENTERPRISE_EVENT_STATUSES: dict[str, list[dict[str, Any]]] = {
    "future-tech-live": [
        {"email": "enterprise.novasync@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.ecopulse@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.databridge@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.mediasphere@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.logiflow@ivep.test", "status": "pending_admin_approval", "stand_fee_paid": False},
    ],
    "green-summit-payment-done": [
        {"email": "enterprise.novasync@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.ecopulse@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.logiflow@ivep.test", "status": "pending_admin_approval", "stand_fee_paid": False},
        {"email": "enterprise.databridge@ivep.test", "status": "pending_payment", "stand_fee_paid": False},
        {"email": "enterprise.mediasphere@ivep.test", "status": "rejected", "stand_fee_paid": False, "rejection_reason": "Capacity aligned with sponsor quota."},
    ],
    "finops-approved": [
        {"email": "enterprise.ecopulse@ivep.test", "status": "pending_admin_approval", "stand_fee_paid": False},
        {"email": "enterprise.databridge@ivep.test", "status": "pending_payment", "stand_fee_paid": False},
    ],
    "ops-expo-pending": [
        {"email": "enterprise.mediasphere@ivep.test", "status": "pending_admin_approval", "stand_fee_paid": False},
    ],
    "marketplace-closed": [
        {"email": "enterprise.databridge@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.mediasphere@ivep.test", "status": "approved", "stand_fee_paid": True},
        {"email": "enterprise.logiflow@ivep.test", "status": "approved", "stand_fee_paid": True},
    ],
}


VISITOR_EVENT_MEMBERSHIP: dict[str, list[int]] = {
    "future-tech-live": [1, 2, 3, 4, 5, 6, 7],
    "green-summit-payment-done": [3, 4, 5, 6, 8, 9],
    "marketplace-closed": [1, 2, 8, 9, 10],
    "finops-approved": [6, 7, 10],
}


def _oid_filter(value: str) -> dict[str, Any]:
    from bson import ObjectId

    if ObjectId.is_valid(value):
        return {"_id": ObjectId(value)}
    return {"_id": value}


def _doc_id(doc: dict[str, Any]) -> str:
    """Canonical seeded reference id: prefer MongoDB _id, fallback to mirrored id."""
    return str(doc.get("_id") or doc.get("id") or "")


async def _refresh_by_id(collection_name: str, record_id: str) -> dict[str, Any] | None:
    from app.db.utils import stringify_object_ids

    db = get_database()
    doc = await db[collection_name].find_one(_oid_filter(record_id))
    return stringify_object_ids(doc) if doc else None


async def _upsert_user(blueprint: dict[str, Any], summary: SeedSummary) -> dict[str, Any]:
    db = get_database()
    existing = await get_user_by_email(blueprint["email"])
    seeded_password_hash = get_password_hash(SEED_PASSWORD)
    base_payload = {
        "email": blueprint["email"],
        "full_name": blueprint["full_name"],
        "role": blueprint["role"],
        "is_active": True,
        "hashed_password": seeded_password_hash,
        "bio": blueprint["bio"],
        "title": blueprint["title"],
        "company": blueprint["company"],
        "phone": blueprint.get("phone", ""),
        "city": blueprint.get("city", ""),
        "country": blueprint.get("country", ""),
        "interests": blueprint["interests"],
        "networking_goals": blueprint["networking_goals"],
        "avatar_url": None,
        "professional_info": {
            "job_title": blueprint["title"],
            "company": blueprint["company"],
            "industry": blueprint["interests"][0].title() if blueprint["interests"] else None,
        },
    }

    if existing:
        await db.users.update_one(
            _oid_filter(_doc_id(existing)),
            {"$set": base_payload, "$setOnInsert": {"created_at": NOW}},
        )
        summary.users_updated += 1
        return await _refresh_by_id("users", _doc_id(existing))

    user_payload = {
        **base_payload,
        "created_at": NOW,
    }
    created = await create_user(user_payload)
    summary.users_created += 1
    return created


async def _upsert_organization(blueprint: dict[str, Any], users_by_email: dict[str, dict[str, Any]], summary: SeedSummary) -> dict[str, Any]:
    from app.db.utils import stringify_object_ids

    db = get_database()
    owner = users_by_email[blueprint["owner_email"]]
    existing = await db.organizations.find_one({"name": blueprint["name"]})
    owner_id = _doc_id(owner)
    update_fields = {
        "name": blueprint["name"],
        "description": blueprint["description"],
        "owner_id": owner_id,
        "industry": blueprint["industry"],
        "website": blueprint["website"],
        "logo_url": blueprint["logo_url"],
        "contact_email": blueprint["contact_email"],
        "is_verified": blueprint["is_verified"],
        "is_flagged": False,
        "is_suspended": False,
        "theme_color": blueprint["theme_color"],
    }

    if existing:
        org_id = str(existing["_id"])
        await db.organizations.update_one(_oid_filter(org_id), {"$set": update_fields})
        await add_organization_member(org_id, owner_id, OrgMemberRole.OWNER)
        summary.organizations_updated += 1
        refreshed = await _refresh_by_id("organizations", org_id)
        return refreshed if refreshed else stringify_object_ids(existing)

    created = await create_organization(
        OrganizationCreate(name=blueprint["name"], description=blueprint["description"]),
        owner_id,
    )
    created_org_id = _doc_id(created)
    await db.organizations.update_one(_oid_filter(created_org_id), {"$set": update_fields})
    await add_organization_member(created_org_id, owner_id, OrgMemberRole.OWNER)
    summary.organizations_created += 1
    refreshed = await _refresh_by_id("organizations", created_org_id)
    return refreshed if refreshed else created


async def _upsert_event(blueprint: dict[str, Any], users_by_email: dict[str, dict[str, Any]], summary: SeedSummary) -> dict[str, Any]:
    db = get_database()
    existing = await db.events.find_one({"title": blueprint["title"]})
    timeline_text, schedule_days = _serialize_schedule(blueprint["day_specs"])
    organizer = users_by_email[blueprint["organizer_email"]]
    event_update = {
        "title": blueprint["title"],
        "description": blueprint["description"],
        "organizer_id": _doc_id(organizer),
        "organizer_name": blueprint["organizer_name"],
        "category": blueprint["category"],
        "location": blueprint["location"],
        "banner_url": blueprint["banner_url"],
        "tags": blueprint["tags"],
        "num_enterprises": blueprint["num_enterprises"],
        "stand_price": blueprint["stand_price"],
        "is_paid": blueprint["is_paid"],
        "ticket_price": blueprint["ticket_price"],
        "state": blueprint["state"],
        "payment_amount": blueprint["payment_amount"],
        "payment_proof_url": "/payments/proof-placeholder.png" if blueprint["payment_amount"] else None,
        "rib_code": "007 999 000123456789 01" if blueprint["payment_amount"] else None,
        "enterprise_link": blueprint["enterprise_link"],
        "visitor_link": blueprint["visitor_link"],
        "rejection_reason": None,
        "event_timeline": timeline_text,
        "schedule_days": [item.model_dump() for item in schedule_days],
        "extended_details": blueprint["extended_details"],
        "additional_info": blueprint["additional_info"],
        "created_at": blueprint["created_at"],
        "start_date": blueprint["start_date"],
        "end_date": blueprint["end_date"],
    }

    if existing:
        event_id = str(existing["_id"])
        await db.events.update_one(_oid_filter(event_id), {"$set": event_update})
        summary.events_updated += 1
        refreshed = await _refresh_by_id("events", event_id)
        return refreshed if refreshed else existing

    created = await create_event(
        EventCreate(
            title=blueprint["title"],
            description=blueprint["description"],
            category=blueprint["category"],
            start_date=blueprint["start_date"],
            end_date=blueprint["end_date"],
            location=blueprint["location"],
            banner_url=blueprint["banner_url"],
            tags=blueprint["tags"],
            organizer_name=blueprint["organizer_name"],
            num_enterprises=blueprint["num_enterprises"],
            event_timeline=timeline_text,
            schedule_days=schedule_days,
            extended_details=blueprint["extended_details"],
            additional_info=blueprint["additional_info"],
            stand_price=blueprint["stand_price"],
            is_paid=blueprint["is_paid"],
            ticket_price=blueprint["ticket_price"],
        ),
        _doc_id(organizer),
    )
    created_event_id = _doc_id(created)
    await db.events.update_one(_oid_filter(created_event_id), {"$set": event_update})
    summary.events_created += 1
    refreshed = await _refresh_by_id("events", created_event_id)
    return refreshed if refreshed else created


async def _upsert_participant(doc: dict[str, Any], summary: SeedSummary) -> dict[str, Any]:
    from app.db.utils import stringify_object_ids

    db = get_database()
    query = {"event_id": doc["event_id"]}
    if doc.get("organization_id"):
        query["organization_id"] = doc["organization_id"]
        query["role"] = doc.get("role")
    else:
        query["user_id"] = doc["user_id"]

    existing = await db.participants.find_one(query)
    if existing:
        participant_id = str(existing["_id"])
        await db.participants.update_one(_oid_filter(participant_id), {"$set": doc})
        summary.participants_updated += 1
        refreshed = await _refresh_by_id("participants", participant_id)
        return refreshed if refreshed else stringify_object_ids(existing)

    result = await db.participants.insert_one(doc)
    summary.participants_created += 1
    return await _refresh_by_id("participants", str(result.inserted_id))


async def _upsert_enterprise_participants(
    events_by_key: dict[str, dict[str, Any]],
    users_by_email: dict[str, dict[str, Any]],
    organizations_by_name: dict[str, dict[str, Any]],
    summary: SeedSummary,
) -> dict[tuple[str, str], dict[str, Any]]:
    participants: dict[tuple[str, str], dict[str, Any]] = {}
    org_by_owner_email = {
        blueprint["owner_email"]: organizations_by_name[blueprint["name"]]
        for blueprint in ORGANIZATION_BLUEPRINTS
    }

    for event_key, assignments in ENTERPRISE_EVENT_STATUSES.items():
        event = events_by_key[event_key]
        for offset, assignment in enumerate(assignments, start=1):
            user = users_by_email[assignment["email"]]
            organization = org_by_owner_email[assignment["email"]]
            participant_doc = {
                "event_id": _doc_id(event),
                "organization_id": _doc_id(organization),
                "user_id": _doc_id(user),
                "role": Role.ENTERPRISE.value,
                "status": assignment["status"],
                "stand_fee_paid": assignment.get("stand_fee_paid", False),
                "payment_reference": f"SEED-{event_key.upper()}-{offset:02d}" if assignment.get("stand_fee_paid") else None,
                "created_at": event["created_at"] + timedelta(hours=offset),
                "rejection_reason": assignment.get("rejection_reason"),
            }
            participant = await _upsert_participant(participant_doc, summary)
            participants[(event_key, assignment["email"])] = participant
    return participants


async def _upsert_visitor_participants(events_by_key: dict[str, dict[str, Any]], users_by_email: dict[str, dict[str, Any]], summary: SeedSummary) -> dict[tuple[str, str], dict[str, Any]]:
    participants: dict[tuple[str, str], dict[str, Any]] = {}
    for event_key, visitor_indexes in VISITOR_EVENT_MEMBERSHIP.items():
        event = events_by_key[event_key]
        for offset, visitor_index in enumerate(visitor_indexes, start=1):
            email = f"visitor{visitor_index:02d}@ivep.test"
            user = users_by_email[email]
            participant_doc = {
                "event_id": _doc_id(event),
                "user_id": _doc_id(user),
                "role": Role.VISITOR.value,
                "status": "approved",
                "created_at": event["created_at"] + timedelta(days=1, hours=offset),
            }
            participant = await _upsert_participant(participant_doc, summary)
            participants[(event_key, email)] = participant
    return participants


async def _ensure_stand(event: dict[str, Any], organization: dict[str, Any], summary: SeedSummary) -> dict[str, Any]:
    event_id = _doc_id(event)
    organization_id = _doc_id(organization)
    existing = await get_stand_by_org(event_id, organization_id)
    stand_name = f"{organization['name']} Stand"
    base_branding = {
        "description": organization.get("description"),
        "logo_url": organization.get("logo_url"),
        "theme_color": organization.get("theme_color", "#1e293b"),
        "stand_background_url": f"/stands/{organization['name'].lower().replace(' ', '-')}-background.jpg",
        "presenter_name": organization.get("name"),
        "presenter_avatar_url": organization.get("logo_url"),
        "tags": [organization.get("industry", "General"), event.get("category", "Event")],
        "category": event.get("category"),
    }

    if existing:
        await update_stand(existing["id"], {"name": stand_name, **base_branding})
        summary.stands_updated += 1
        refreshed = await _refresh_by_id("stands", existing["id"])
        return refreshed if refreshed else existing

    created = await create_stand(event_id, organization_id, stand_name, **base_branding)
    summary.stands_created += 1
    refreshed = await _refresh_by_id("stands", created["id"])
    return refreshed if refreshed else created


async def _upsert_resource(stand: dict[str, Any], title: str, resource_type: str, file_path: str, summary: SeedSummary) -> dict[str, Any]:
    db = get_database()
    existing = await db.resources.find_one({"stand_id": stand["id"], "title": title})
    if existing:
        return await _refresh_by_id("resources", str(existing["_id"]))

    resource = await resource_repo.create_resource(
        ResourceCreate(
            title=title,
            description=f"Seeded {resource_type} resource for {stand['name']}",
            stand_id=stand["id"],
            type=resource_type,
            tags=[stand.get("category") or "general", "seeded"],
            file_path=file_path,
            file_size=2048,
            mime_type="application/pdf" if resource_type in {ResourceType.PDF, ResourceType.DOCUMENT} else "image/png",
        )
    )
    summary.resources_created += 1
    return resource


async def _upsert_enterprise_product(
    enterprise_user_id: str,
    organization_id: str,
    name: str,
    category: str,
    price: float,
    summary: SeedSummary,
    product_type: str = "product",
    stock: int = 25,
) -> dict[str, Any]:
    db = get_database()
    existing = await db.products.find_one({"enterprise_id": enterprise_user_id, "name": name, "is_active": True})
    resolved_type = "service" if product_type == "service" else "product"
    resolved_stock = 0 if resolved_type == "service" else stock
    if existing:
        await db.products.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "description": f"Seeded product for {name} ({category})",
                    "price": price,
                    "currency": "MAD",
                    "image_url": "/product_images/default-seed-product.png",
                    "stock": resolved_stock,
                    "type": resolved_type,
                    "is_active": True,
                }
            },
        )
        return await _refresh_by_id("products", str(existing["_id"]))

    product = await enterprise_repo.create_product(
        enterprise_user_id,
        organization_id,
        ProductCreate(
            name=name,
            description=f"Seeded product for {name} ({category})",
            price=price,
            currency="MAD",
            image_url="/product_images/default-seed-product.png",
            stock=resolved_stock,
            type=resolved_type,
            is_active=True,
        ),
    )
    summary.enterprise_products_created += 1
    return product


async def _upsert_marketplace_product(
    stand_id: str,
    name: str,
    price: float,
    summary: SeedSummary,
    product_type: str = "product",
    stock: int | None = None,
) -> dict[str, Any]:
    db = get_database()
    from bson import ObjectId

    existing = await db.stand_products.find_one({"stand_id": ObjectId(stand_id), "name": name})
    if existing:
        return {
            "id": str(existing["_id"]),
            "stand_id": str(existing["stand_id"]),
            "name": existing["name"],
            "price": existing["price"],
            "type": existing.get("type", "product"),
        }

    resolved_type = "service" if product_type == "service" else "product"
    resolved_stock = 0 if resolved_type == "service" else int(stock if stock is not None else 12)
    product = await marketplace_service.create_product(
        stand_id,
        {
            "name": name,
            "description": f"Seeded marketplace item for {name}",
            "price": price,
            "currency": "usd",
            "image_url": "/product_images/marketplace-seed-item.png",
            "stock": resolved_stock,
            "type": resolved_type,
        },
    )
    summary.marketplace_products_created += 1
    return product


async def _upsert_product_request(
    visitor_id: str,
    enterprise_id: str,
    product_id: str,
    event_id: str,
    message: str,
    quantity: int | None,
    summary: SeedSummary,
) -> dict[str, Any]:
    db = get_database()
    existing = await db.product_requests.find_one(
        {
            "visitor_id": visitor_id,
            "enterprise_id": enterprise_id,
            "product_id": product_id,
            "event_id": event_id,
        }
    )
    if existing:
        return await _refresh_by_id("product_requests", str(existing["_id"]))

    created = await enterprise_repo.create_product_request(
        visitor_id=visitor_id,
        enterprise_id=enterprise_id,
        product_id=product_id,
        event_id=event_id,
        message=message,
        quantity=quantity,
    )
    summary.product_requests_created += 1
    return created


async def _upsert_stand_order(
    product_id: str,
    stand_id: str,
    buyer_id: str,
    product_name: str,
    quantity: int,
    total_amount: float,
    summary: SeedSummary,
    payment_method: str = "stripe",
) -> dict[str, Any]:
    db = get_database()
    from bson import ObjectId

    existing = await db.stand_orders.find_one(
        {
            "product_id": ObjectId(product_id),
            "stand_id": ObjectId(stand_id),
            "buyer_id": ObjectId(buyer_id),
            "product_name": product_name,
        }
    )
    if existing:
        return {
            "id": str(existing["_id"]),
            "status": existing.get("status"),
        }

    order = await marketplace_service.create_order(
        product_id=product_id,
        stand_id=stand_id,
        buyer_id=buyer_id,
        product_name=product_name,
        quantity=quantity,
        total_amount=total_amount,
        unit_price=total_amount / max(quantity, 1),
        payment_method=payment_method,
        stripe_session_id=f"seed-order-{stand_id[-6:]}-{buyer_id[-6:]}" if payment_method == "stripe" else "",
    )
    if payment_method == "stripe":
        await marketplace_service.mark_order_paid(order["id"], f"pi_seed_{order['id'][-8:]}")
    summary.stand_orders_created += 1
    return order


async def _upsert_payment(event_id: str, user_id: str, amount: float, session_id: str, paid: bool, summary: SeedSummary) -> dict[str, Any]:
    db = get_database()
    existing = await db.event_payments.find_one({"event_id": event_id, "user_id": user_id, "stripe_session_id": session_id})
    if existing:
        return await _refresh_by_id("event_payments", str(existing["_id"]))

    payment = await create_payment(event_id=event_id, user_id=user_id, amount=amount, stripe_session_id=session_id)
    if paid:
        payment = await mark_payment_paid(payment["id"], stripe_payment_intent_id=f"pi_{session_id[-10:]}")
    summary.payments_created += 1
    return payment


async def _upsert_meeting(payload: MeetingCreate, status: str, summary: SeedSummary, session_status: str | None = None) -> dict[str, Any]:
    db = get_database()
    existing = await db.meetings.find_one(
        {
            "event_id": payload.event_id,
            "visitor_id": payload.visitor_id,
            "stand_id": payload.stand_id,
            "purpose": payload.purpose,
        }
    )
    if existing:
        meeting_id = str(existing["_id"])
        await db.meetings.update_one(
            _oid_filter(meeting_id),
            {
                "$set": {
                    **payload.model_dump(),
                    "status": status,
                    "session_status": session_status or existing.get("session_status", "scheduled"),
                    "updated_at": NOW,
                }
            },
        )
        return await _refresh_by_id("meetings", meeting_id)

    meeting = await meeting_repo.create_meeting(payload)
    summary.meetings_created += 1
    if status != MeetingStatus.PENDING.value:
        await meeting_repo.update_meeting_status(meeting["_id"], MeetingUpdate(status=status, notes="Seeded workflow status"))
    if session_status == "live":
        await meeting_repo.start_session(meeting["_id"])
    elif session_status == "ended":
        await meeting_repo.start_session(meeting["_id"])
        await meeting_repo.end_session(meeting["_id"])
    return await _refresh_by_id("meetings", meeting["_id"])


async def _ensure_chat_room(user1_id: str, user2_id: str, room_category: str, event_id: str, summary: SeedSummary) -> dict[str, Any]:
    db = get_database()
    before = await db.chat_rooms.count_documents({})
    room = await chat_repo.get_or_create_direct_room(user1_id, user2_id, room_category=room_category, event_id=event_id)
    after = await db.chat_rooms.count_documents({})
    if after > before:
        summary.chat_rooms_created += 1
    return {"id": str(room.id), "event_id": room.event_id, "members": room.members}


async def _ensure_chat_message(room_id: str, sender_id: str, sender_name: str, content: str, event_id: str, timestamp: datetime, summary: SeedSummary) -> dict[str, Any]:
    db = get_database()
    existing = await db.chat_messages.find_one({"room_id": room_id, "sender_id": sender_id, "content": content})
    if existing:
        return await _refresh_by_id("chat_messages", str(existing["_id"]))

    message = await chat_repo.create_message(
        {
            "room_id": room_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "content": content,
            "type": "text",
            "event_id": event_id,
            "timestamp": timestamp,
        }
    )
    summary.chat_messages_created += 1
    return message.model_dump(by_alias=True)


async def _upsert_conference(doc: dict[str, Any], summary: SeedSummary) -> dict[str, Any]:
    db = get_database()
    existing = await db.conferences.find_one({"event_id": doc["event_id"], "title": doc["title"]})
    if existing:
        conference_id = str(existing["_id"])
        await db.conferences.update_one(_oid_filter(conference_id), {"$set": doc})
        return await _refresh_by_id("conferences", conference_id)

    conference = await conf_repo.create(doc)
    summary.conferences_created += 1
    return await _refresh_by_id("conferences", conference["_id"])


async def _ensure_conference_registration(conference_id: str, user_id: str, user_role: str, summary: SeedSummary) -> None:
    created = await conf_repo.register(conference_id, user_id, user_role)
    if created:
        summary.conference_registrations_created += 1


async def _ensure_lead_interaction(visitor_id: str, stand_id: str, interaction_type: str, event_id: str) -> None:
    db = get_database()
    seed_key = f"{event_id}:{stand_id}:{visitor_id}:{interaction_type}"
    existing = await db.lead_interactions.find_one({"visitor_id": visitor_id, "stand_id": stand_id, "metadata.seed_key": seed_key})
    if existing:
        return
    await lead_service.log_interaction(
        LeadInteraction(
            visitor_id=visitor_id,
            stand_id=stand_id,
            interaction_type=interaction_type,
            metadata={"seed_key": seed_key, "event_id": event_id},
            timestamp=NOW - timedelta(minutes=8),
        )
    )
    await db.leads.update_one(
        {"visitor_id": visitor_id, "stand_id": stand_id},
        {"$set": {"event_id": event_id, "created_at": NOW - timedelta(minutes=8)}},
    )


async def _ensure_analytics_event(
    event_type: AnalyticsEventType,
    user_id: str | None,
    event_id: str | None,
    stand_id: str | None,
    metadata: dict[str, Any],
    timestamp: datetime,
    summary: SeedSummary,
) -> None:
    db = get_database()
    query = {
        "type": event_type.value,
        "event_id": event_id,
        "stand_id": stand_id,
        "metadata.seed_key": metadata["seed_key"],
    }
    existing = await db.analytics_events.find_one(query)
    if existing:
        await db.analytics_events.update_one(
            _oid_filter(str(existing["_id"])),
            {"$set": {"timestamp": timestamp, "created_at": timestamp}},
        )
        return

    event = await log_event_persistent(
        type=event_type,
        user_id=user_id,
        event_id=event_id,
        stand_id=stand_id,
        metadata=metadata,
    )
    await db.analytics_events.update_one(
        _oid_filter(event["_id"]),
        {"$set": {"timestamp": timestamp, "created_at": timestamp}},
    )
    summary.analytics_events_created += 1


async def _ensure_content_flag(event_id: str, stand_id: str, status: str, reason: str, summary: SeedSummary) -> None:
    db = get_database()
    existing = await db.content_flags.find_one({"event_id": event_id, "stand_id": stand_id, "reason": reason})
    if existing:
        return
    await db.content_flags.insert_one(
        {
            "event_id": event_id,
            "stand_id": stand_id,
            "reason": reason,
            "status": status,
            "resolved": status == "resolved",
            "created_at": NOW - timedelta(days=1),
        }
    )
    summary.content_flags_created += 1


async def _ensure_answered_question(conference_id: str, user_id: str, user_name: str, question: str, answer: str) -> None:
    db = get_database()
    existing = await db.conference_qa.find_one(
        {
            "conference_id": conference_id,
            "user_id": user_id,
            "question": question,
        }
    )
    if existing:
        await conf_repo.answer_question(str(existing["_id"]), answer)
        return

    created = await conf_repo.add_question(conference_id, user_id, user_name, question)
    await conf_repo.answer_question(created["_id"], answer)


async def seed_platform_test_data() -> SeedSummary:
    summary = SeedSummary()
    await connect_to_mongo()
    try:
        users_by_email: dict[str, dict[str, Any]] = {}
        for blueprint in USER_BLUEPRINTS:
            user = await _upsert_user(blueprint, summary)
            users_by_email[blueprint["email"]] = user

        organizations_by_name: dict[str, dict[str, Any]] = {}
        for blueprint in ORGANIZATION_BLUEPRINTS:
            organization = await _upsert_organization(blueprint, users_by_email, summary)
            organizations_by_name[blueprint["name"]] = organization

        events_by_key: dict[str, dict[str, Any]] = {}
        for blueprint in _event_blueprints():
            event = await _upsert_event(blueprint, users_by_email, summary)
            events_by_key[blueprint["key"]] = event

        await _upsert_enterprise_participants(events_by_key, users_by_email, organizations_by_name, summary)
        await _upsert_visitor_participants(events_by_key, users_by_email, summary)

        org_by_owner_email = {
            blueprint["owner_email"]: organizations_by_name[blueprint["name"]]
            for blueprint in ORGANIZATION_BLUEPRINTS
        }

        stands_by_event_org: dict[tuple[str, str], dict[str, Any]] = {}
        for event_key, assignments in ENTERPRISE_EVENT_STATUSES.items():
            event = events_by_key[event_key]
            for assignment in assignments:
                if assignment["status"] != "approved":
                    continue
                organization = org_by_owner_email[assignment["email"]]
                stand = await _ensure_stand(event, organization, summary)
                stands_by_event_org[(event_key, assignment["email"])] = stand

                await _upsert_resource(stand, f"{organization['name']} Product Deck", ResourceType.PDF, "/resources/seed-product-deck.pdf", summary)
                await _upsert_resource(stand, f"{organization['name']} Demo Reel", ResourceType.VIDEO, "/resources/seed-demo-reel.mp4", summary)
                await _upsert_resource(stand, f"{organization['name']} Brochure", ResourceType.DOCUMENT, "/resources/seed-brochure.docx", summary)

        enterprise_products: dict[str, list[dict[str, Any]]] = {}
        marketplace_products: dict[str, list[dict[str, Any]]] = {}
        for blueprint in ORGANIZATION_BLUEPRINTS:
            owner = users_by_email[blueprint["owner_email"]]
            organization = organizations_by_name[blueprint["name"]]
            enterprise_products[blueprint["owner_email"]] = [
                await _upsert_enterprise_product(owner["id"], organization["id"], f"{organization['name']} Suite", blueprint["industry"], 1499.0, summary, product_type="product", stock=25),
                await _upsert_enterprise_product(owner["id"], organization["id"], f"{organization['name']} Advisory", blueprint["industry"], 2200.0, summary, product_type="service", stock=0),
            ]

        for (_, owner_email), stand in stands_by_event_org.items():
            marketplace_products.setdefault(owner_email, [])
            marketplace_products[owner_email].append(
                await _upsert_marketplace_product(stand["id"], f"{stand['name']} Starter Package", 199.0, summary, product_type="product", stock=12)
            )
            marketplace_products[owner_email].append(
                await _upsert_marketplace_product(stand["id"], f"{stand['name']} Premium Package", 499.0, summary, product_type="product", stock=7)
            )
            marketplace_products[owner_email].append(
                await _upsert_marketplace_product(stand["id"], f"{stand['name']} Advisory Service", 299.0, summary, product_type="service", stock=0)
            )

        future_event = events_by_key["future-tech-live"]
        green_event = events_by_key["green-summit-payment-done"]
        closed_event = events_by_key["marketplace-closed"]

        await _upsert_payment(future_event["id"], users_by_email["organizer.amine@ivep.test"]["id"], 13500.0, "seed-org-payment-future-tech", True, summary)
        await _upsert_payment(green_event["id"], users_by_email["organizer.salma@ivep.test"]["id"], 9600.0, "seed-org-payment-green-summit", True, summary)
        await _upsert_payment(closed_event["id"], users_by_email["organizer.amine@ivep.test"]["id"], 5600.0, "seed-org-payment-marketplace", True, summary)

        for visitor_index in [1, 2, 3, 4]:
            visitor = users_by_email[f"visitor{visitor_index:02d}@ivep.test"]
            await _upsert_payment(future_event["id"], visitor["id"], 79.0, f"seed-ticket-future-tech-{visitor_index:02d}", True, summary)

        for visitor_index in [1, 2, 3]:
            visitor = users_by_email[f"visitor{visitor_index:02d}@ivep.test"]
            owner_email = ["enterprise.novasync@ivep.test", "enterprise.ecopulse@ivep.test", "enterprise.databridge@ivep.test"][visitor_index - 1]
            product = enterprise_products[owner_email][0]
            stand = stands_by_event_org[("future-tech-live", owner_email)]
            await _upsert_product_request(
                visitor_id=visitor["id"],
                enterprise_id=users_by_email[owner_email]["id"],
                product_id=product["id"],
                event_id=future_event["id"],
                message="We want a live product demo and pricing details.",
                quantity=visitor_index,
                summary=summary,
            )
            service_product = enterprise_products[owner_email][1]
            await _upsert_product_request(
                visitor_id=visitor["id"],
                enterprise_id=users_by_email[owner_email]["id"],
                product_id=service_product["id"],
                event_id=future_event["id"],
                message="We need a service onboarding call and implementation details.",
                quantity=None,
                summary=summary,
            )
            market_product = marketplace_products[owner_email][0]
            await _upsert_stand_order(
                market_product["id"],
                stand["id"],
                visitor["id"],
                market_product["name"],
                1,
                float(market_product["price"]),
                summary,
                payment_method="cash_on_delivery" if visitor_index == 1 else "stripe",
            )

        live_stand = stands_by_event_org[("future-tech-live", "enterprise.novasync@ivep.test")]
        eco_stand = stands_by_event_org[("future-tech-live", "enterprise.ecopulse@ivep.test")]
        data_stand = stands_by_event_org[("future-tech-live", "enterprise.databridge@ivep.test")]

        await _upsert_meeting(
            MeetingCreate(
                event_id=future_event["id"],
                visitor_id=users_by_email["visitor01@ivep.test"]["id"],
                stand_id=live_stand["id"],
                start_time=NOW - timedelta(minutes=20),
                end_time=NOW + timedelta(minutes=20),
                purpose="AI platform architecture review",
                meeting_type=MeetingType.ONE_TO_ONE,
                initiator_id=users_by_email["visitor01@ivep.test"]["id"],
            ),
            status=MeetingStatus.APPROVED.value,
            session_status="live",
            summary=summary,
        )
        await _upsert_meeting(
            MeetingCreate(
                event_id=future_event["id"],
                visitor_id=users_by_email["enterprise.ecopulse@ivep.test"]["id"],
                stand_id=data_stand["id"],
                start_time=NOW - timedelta(hours=2),
                end_time=NOW - timedelta(hours=1, minutes=15),
                purpose="B2B data exchange partnership",
                meeting_type=MeetingType.B2B,
                initiator_id=users_by_email["enterprise.ecopulse@ivep.test"]["id"],
            ),
            status=MeetingStatus.COMPLETED.value,
            session_status="ended",
            summary=summary,
        )
        await _upsert_meeting(
            MeetingCreate(
                event_id=green_event["id"],
                visitor_id=users_by_email["visitor04@ivep.test"]["id"],
                stand_id=stands_by_event_org[("green-summit-payment-done", "enterprise.novasync@ivep.test")]["id"],
                start_time=NOW + timedelta(days=5, hours=2),
                end_time=NOW + timedelta(days=5, hours=2, minutes=30),
                purpose="Pre-event solution walkthrough",
                meeting_type=MeetingType.ONE_TO_ONE,
                initiator_id=users_by_email["visitor04@ivep.test"]["id"],
            ),
            status=MeetingStatus.APPROVED.value,
            session_status="scheduled",
            summary=summary,
        )
        await _upsert_meeting(
            MeetingCreate(
                event_id=future_event["id"],
                visitor_id=users_by_email["visitor05@ivep.test"]["id"],
                stand_id=eco_stand["id"],
                start_time=NOW + timedelta(hours=3),
                end_time=NOW + timedelta(hours=3, minutes=30),
                purpose="Requesting procurement alignment discussion",
                meeting_type=MeetingType.ONE_TO_ONE,
                initiator_id=users_by_email["visitor05@ivep.test"]["id"],
            ),
            status=MeetingStatus.PENDING.value,
            session_status="scheduled",
            summary=summary,
        )
        await _upsert_meeting(
            MeetingCreate(
                event_id=future_event["id"],
                visitor_id=users_by_email["visitor06@ivep.test"]["id"],
                stand_id=data_stand["id"],
                start_time=NOW - timedelta(hours=5),
                end_time=NOW - timedelta(hours=4, minutes=30),
                purpose="Rejected due to overlapping executive agenda",
                meeting_type=MeetingType.ONE_TO_ONE,
                initiator_id=users_by_email["visitor06@ivep.test"]["id"],
            ),
            status=MeetingStatus.REJECTED.value,
            session_status="scheduled",
            summary=summary,
        )
        await _upsert_meeting(
            MeetingCreate(
                event_id=green_event["id"],
                visitor_id=users_by_email["visitor09@ivep.test"]["id"],
                stand_id=stands_by_event_org[("green-summit-payment-done", "enterprise.ecopulse@ivep.test")]["id"],
                start_time=NOW + timedelta(days=5, hours=4),
                end_time=NOW + timedelta(days=5, hours=4, minutes=30),
                purpose="Canceled by requester after schedule conflict",
                meeting_type=MeetingType.ONE_TO_ONE,
                initiator_id=users_by_email["visitor09@ivep.test"]["id"],
            ),
            status=MeetingStatus.CANCELED.value,
            session_status="scheduled",
            summary=summary,
        )

        visitor_room = await _ensure_chat_room(
            users_by_email["visitor01@ivep.test"]["id"],
            users_by_email["enterprise.novasync@ivep.test"]["id"],
            room_category="visitor",
            event_id=future_event["id"],
            summary=summary,
        )
        await _ensure_chat_message(visitor_room["id"], users_by_email["visitor01@ivep.test"]["id"], "Visitor 01", "Hi, I would like a live demo of your automation platform.", future_event["id"], NOW - timedelta(minutes=12), summary)
        await _ensure_chat_message(visitor_room["id"], users_by_email["enterprise.novasync@ivep.test"]["id"], "Yassine Haddad", "We can start with the live assistant module and the analytics dashboard.", future_event["id"], NOW - timedelta(minutes=10), summary)

        b2b_room = await _ensure_chat_room(
            users_by_email["enterprise.ecopulse@ivep.test"]["id"],
            users_by_email["enterprise.databridge@ivep.test"]["id"],
            room_category="b2b",
            event_id=future_event["id"],
            summary=summary,
        )
        await _ensure_chat_message(b2b_room["id"], users_by_email["enterprise.ecopulse@ivep.test"]["id"], "Lina Ait Omar", "Can we discuss joint reporting dashboards for sustainability clients?", future_event["id"], NOW - timedelta(minutes=18), summary)
        await _ensure_chat_message(b2b_room["id"], users_by_email["enterprise.databridge@ivep.test"]["id"], "Karim Boussouf", "Yes, let us align on the pipeline and meeting agenda.", future_event["id"], NOW - timedelta(minutes=16), summary)

        live_conference = await _upsert_conference(
            {
                "title": "Building Production-Ready AI Experiences",
                "description": "Live seeded conference session for audience joins, Q&A, and analytics validation.",
                "speaker_name": "Yassine Haddad",
                "assigned_enterprise_id": users_by_email["enterprise.novasync@ivep.test"]["id"],
                "organizer_id": users_by_email["organizer.amine@ivep.test"]["id"],
                "event_id": future_event["id"],
                "stand_id": live_stand["id"],
                "start_time": NOW - timedelta(minutes=25),
                "end_time": NOW + timedelta(minutes=35),
                "status": "live",
                "livekit_room_name": "seed-future-tech-ai-stage",
                "max_attendees": 250,
                "chat_enabled": True,
                "qa_enabled": True,
            },
            summary,
        )
        ended_conference = await _upsert_conference(
            {
                "title": "Scaling Marketplace Revenue After Events",
                "description": "Closed seeded conference for historical reporting.",
                "speaker_name": "Sara Mernissi",
                "assigned_enterprise_id": users_by_email["enterprise.mediasphere@ivep.test"]["id"],
                "organizer_id": users_by_email["organizer.amine@ivep.test"]["id"],
                "event_id": closed_event["id"],
                "stand_id": stands_by_event_org[("marketplace-closed", "enterprise.mediasphere@ivep.test")]["id"],
                "start_time": NOW - timedelta(days=44, hours=1),
                "end_time": NOW - timedelta(days=44),
                "status": "ended",
                "livekit_room_name": "seed-marketplace-growth-stage",
                "max_attendees": 180,
                "chat_enabled": True,
                "qa_enabled": True,
            },
            summary,
        )

        for attendee_email in ["visitor01@ivep.test", "visitor02@ivep.test", "visitor03@ivep.test", "enterprise.ecopulse@ivep.test"]:
            user = users_by_email[attendee_email]
            await _ensure_conference_registration(live_conference["id"], user["id"], user["role"], summary)

        await _ensure_conference_registration(ended_conference["id"], users_by_email["visitor08@ivep.test"]["id"], Role.VISITOR.value, summary)
        await _ensure_answered_question(
            live_conference["id"],
            users_by_email["visitor02@ivep.test"]["id"],
            "Visitor 02",
            "How do you monitor live AI feature adoption?",
            "We combine chat, meeting, and product analytics into one dashboard.",
        )

        for visitor_email, stand in [
            ("visitor01@ivep.test", live_stand),
            ("visitor02@ivep.test", eco_stand),
            ("visitor03@ivep.test", data_stand),
            ("visitor04@ivep.test", live_stand),
        ]:
            await _ensure_lead_interaction(users_by_email[visitor_email]["id"], stand["id"], "visit", future_event["id"])
            await _ensure_lead_interaction(users_by_email[visitor_email]["id"], stand["id"], "chat", future_event["id"])

        analytics_specs = [
            (AnalyticsEventType.EVENT_VIEW, "visitor01@ivep.test", future_event["id"], None, {"seed_key": "future-event-view-01"}, NOW - timedelta(minutes=14)),
            (AnalyticsEventType.EVENT_VIEW, "visitor02@ivep.test", future_event["id"], None, {"seed_key": "future-event-view-02"}, NOW - timedelta(minutes=13)),
            (AnalyticsEventType.STAND_VISIT, "visitor01@ivep.test", future_event["id"], live_stand["id"], {"seed_key": "future-stand-visit-01"}, NOW - timedelta(minutes=12)),
            (AnalyticsEventType.STAND_VISIT, "visitor02@ivep.test", future_event["id"], eco_stand["id"], {"seed_key": "future-stand-visit-02"}, NOW - timedelta(minutes=11)),
            (AnalyticsEventType.CHAT_OPENED, "visitor01@ivep.test", future_event["id"], live_stand["id"], {"seed_key": "future-chat-open-01", "room_category": "visitor"}, NOW - timedelta(minutes=10)),
            (AnalyticsEventType.CHAT_OPENED, "enterprise.ecopulse@ivep.test", future_event["id"], data_stand["id"], {"seed_key": "future-chat-open-02", "room_category": "b2b"}, NOW - timedelta(minutes=9)),
            (AnalyticsEventType.MEETING_BOOKED, "visitor01@ivep.test", future_event["id"], live_stand["id"], {"seed_key": "future-meeting-booked-01", "purpose": "AI platform architecture review"}, NOW - timedelta(minutes=8)),
            (AnalyticsEventType.PAYMENT_CONFIRMED, "organizer.amine@ivep.test", future_event["id"], None, {"seed_key": "future-payment-confirmed-organizer"}, NOW - timedelta(minutes=7)),
            (AnalyticsEventType.CONFERENCE_JOINED, "visitor01@ivep.test", future_event["id"], live_stand["id"], {"seed_key": "future-conference-joined-01", "conference_id": live_conference["id"]}, NOW - timedelta(minutes=6)),
            (AnalyticsEventType.EVENT_VIEW, "visitor08@ivep.test", closed_event["id"], None, {"seed_key": "closed-event-view-01"}, NOW - timedelta(days=44)),
            (AnalyticsEventType.STAND_VISIT, "visitor08@ivep.test", closed_event["id"], stands_by_event_org[("marketplace-closed", "enterprise.mediasphere@ivep.test")]["id"], {"seed_key": "closed-stand-visit-01"}, NOW - timedelta(days=44, minutes=10)),
        ]
        for event_type, user_email, event_id, stand_id, metadata, timestamp in analytics_specs:
            user_id = users_by_email[user_email]["id"] if user_email else None
            await _ensure_analytics_event(event_type, user_id, event_id, stand_id, metadata, timestamp, summary)

        await _ensure_content_flag(future_event["id"], live_stand["id"], "resolved", "Seeded moderated message sample", summary)
        await _ensure_content_flag(green_event["id"], stands_by_event_org[("green-summit-payment-done", "enterprise.novasync@ivep.test")]["id"], "open", "Seeded pending moderation review", summary)

        summary.notes.extend(
            [
                f"Login password for all seeded users: {SEED_PASSWORD}",
                "Admin account: admin.root@ivep.test",
                "Organizer accounts: organizer.amine@ivep.test, organizer.salma@ivep.test",
                "Enterprise accounts: enterprise.novasync@ivep.test, enterprise.ecopulse@ivep.test, enterprise.databridge@ivep.test, enterprise.mediasphere@ivep.test, enterprise.logiflow@ivep.test",
                "Visitor accounts: visitor01@ivep.test through visitor10@ivep.test",
                "Events seeded across all lifecycle states: pending_approval, approved, rejected, waiting_for_payment, payment_proof_submitted, payment_done, live, and closed.",
                "Enterprise participation covers pending_admin_approval, pending_payment, approved, and rejected statuses.",
            ]
        )

        return summary
    finally:
        await close_mongo_connection()


def _summary_lines(summary: SeedSummary) -> list[str]:
    return [
        f"users_created={summary.users_created}",
        f"users_updated={summary.users_updated}",
        f"organizations_created={summary.organizations_created}",
        f"organizations_updated={summary.organizations_updated}",
        f"events_created={summary.events_created}",
        f"events_updated={summary.events_updated}",
        f"participants_created={summary.participants_created}",
        f"participants_updated={summary.participants_updated}",
        f"stands_created={summary.stands_created}",
        f"stands_updated={summary.stands_updated}",
        f"resources_created={summary.resources_created}",
        f"enterprise_products_created={summary.enterprise_products_created}",
        f"marketplace_products_created={summary.marketplace_products_created}",
        f"product_requests_created={summary.product_requests_created}",
        f"stand_orders_created={summary.stand_orders_created}",
        f"meetings_created={summary.meetings_created}",
        f"chat_rooms_created={summary.chat_rooms_created}",
        f"chat_messages_created={summary.chat_messages_created}",
        f"conferences_created={summary.conferences_created}",
        f"conference_registrations_created={summary.conference_registrations_created}",
        f"analytics_events_created={summary.analytics_events_created}",
        f"payments_created={summary.payments_created}",
        f"content_flags_created={summary.content_flags_created}",
        *summary.notes,
    ]


async def _main() -> None:
    summary = await seed_platform_test_data()
    print("Platform test seed completed")
    for line in _summary_lines(summary):
        print(f"- {line}")


if __name__ == "__main__":
    asyncio.run(_main())