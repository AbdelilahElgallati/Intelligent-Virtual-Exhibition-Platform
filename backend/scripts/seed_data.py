"""
Comprehensive seed data for the Intelligent Virtual Exhibition Platform.

Run with:
    python -m scripts.seed_data

Seeds:
- 1 Admin, 10 Organizers, 10 Enterprise users, 10 Visitors
- 10 events across all lifecycle states
- 10 organizations with members
- 30+ stands with visual customization
- 50+ resources (PDF, video, image, document)
- Visitor participations across events
- Favorites, notifications, meetings, chat rooms, messages
- Lead interactions and lead records
- Full cross-module interactions for end-to-end testing

The script is idempotent: it upserts by unique fields.
"""

import asyncio
import json
import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from bson import ObjectId

from app.core.security import hash_password
from app.db.mongo import close_mongo_connection, connect_to_mongo, get_database
from app.modules.auth.enums import Role
from app.modules.events.schemas import EventCreate, EventState, ScheduleDay, ScheduleSlot
from app.modules.events.service import (
    approve_event,
    confirm_event_payment,
    create_event,
    get_events_collection,
    update_event_state,
)
from app.modules.favorites.schemas import FavoriteCreate
from app.modules.favorites.service import create_favorite, get_favorites_collection
from app.modules.leads.repository import lead_repo
from app.modules.leads.schemas import LeadInteraction
from app.modules.meetings.repository import meeting_repo
from app.modules.meetings.schemas import MeetingCreate, MeetingStatus, MeetingUpdate
from app.modules.notifications.schemas import NotificationType
from app.modules.notifications.service import (
    create_notification,
    get_notifications_collection,
)
from app.modules.organizations.schemas import OrganizationCreate
from app.modules.organizations.service import (
    add_organization_member,
    create_organization,
    get_members_collection,
    get_organizations_collection,
)
from app.modules.participants.schemas import ParticipantStatus
from app.modules.participants.service import (
    approve_participant,
    get_participants_collection,
    request_to_join,
)
from app.modules.resources.repository import resource_repo
from app.modules.resources.schemas import ResourceCreate
from app.modules.stands.service import create_stand, get_stands_collection
from app.modules.users.service import create_user, get_user_by_email
from app.modules.chat.repository import chat_repo

# ─── Constants ────────────────────────────────────────────────────────────────
PASSWORD = "Password123!"
NOW = datetime.now(timezone.utc)

AVATAR_BASE = "https://randomuser.me/api/portraits"
UNSPLASH = "https://images.unsplash.com/photo-"
UI_AVATARS = "https://ui-avatars.com/api/?name={name}&background={bg}&color=fff&size=256"

# Full-body transparent PNG presenter images (standing professionals, no background)
# These blend naturally with the booth-scene background in VirtualStandLayout
PRESENTER_FULL_BODY = {
    "m": [
        "https://pngimg.com/d/businessman_PNG6557.png",
        "https://pngimg.com/d/businessman_PNG6559.png",
        "https://pngimg.com/d/businessman_PNG6563.png",
        "https://pngimg.com/d/businessman_PNG6567.png",
        "https://pngimg.com/d/businessman_PNG6571.png",
        "https://pngimg.com/d/businessman_PNG6575.png",
        "https://pngimg.com/d/businessman_PNG6579.png",
        "https://pngimg.com/d/businessman_PNG6583.png",
        "https://pngimg.com/d/businessman_PNG6587.png",
        "https://pngimg.com/d/businessman_PNG6591.png",
        "https://pngimg.com/d/businessman_PNG6595.png",
        "https://pngimg.com/d/businessman_PNG6599.png",
    ],
    "f": [
        "https://pngimg.com/d/businesswoman_PNG57.png",
        "https://pngimg.com/d/businesswoman_PNG48.png",
        "https://pngimg.com/d/businesswoman_PNG43.png",
        "https://pngimg.com/d/businesswoman_PNG39.png",
        "https://pngimg.com/d/businesswoman_PNG35.png",
        "https://pngimg.com/d/businesswoman_PNG31.png",
        "https://pngimg.com/d/businesswoman_PNG27.png",
        "https://pngimg.com/d/businesswoman_PNG23.png",
        "https://pngimg.com/d/businesswoman_PNG19.png",
        "https://pngimg.com/d/businesswoman_PNG15.png",
    ],
}
THEME_COLORS = [
    "#1e293b", "#f97316", "#3b82f6", "#10b981", "#8b5cf6",
    "#ef4444", "#06b6d4", "#f59e0b", "#ec4899", "#6366f1",
]

STAND_BACKGROUNDS = [
    f"{UNSPLASH}1604328698692-f76ea9498e76?w=1200",
    f"{UNSPLASH}1497366216548-37526070297c?w=1200",
    f"{UNSPLASH}1522071820081-009f0129c71c?w=1200",
    f"{UNSPLASH}1551434678-e076c223a692?w=1200",
    f"{UNSPLASH}1486406146926-c627a92ad1ab?w=1200",
    f"{UNSPLASH}1560179707-f14e90ef3623?w=1200",
    f"{UNSPLASH}1573164713988-8665fc963095?w=1200",
    f"{UNSPLASH}1507003211169-0a1dd7228f2d?w=1200",
]

CATEGORIES = [
    "Technology", "Engineering", "Healthcare", "Recruitment",
    "Education", "Finance", "Marketing", "Green Energy",
    "Cybersecurity", "AI & Data",
]

TAGS_POOL = [
    "AI", "ML", "Cloud", "DevOps", "Kubernetes", "IoT", "Blockchain",
    "HealthTech", "FinTech", "EdTech", "GreenTech", "Cybersecurity",
    "XR", "VR", "AR", "5G", "Quantum", "SaaS", "Big Data", "Analytics",
    "Robotics", "Biotech", "Sustainability", "Remote Work", "No-Code",
]

INTERACTION_TYPES = ["visit", "resource_download", "chat", "meeting"]

# Event banner images (high-quality conference / expo imagery)
EVENT_BANNERS = [
    f"{UNSPLASH}1540575467063-178a50c2c397?w=1400&h=400&fit=crop",   # conference hall
    f"{UNSPLASH}1576085898323-218337e3e43c?w=1400&h=400&fit=crop",   # medical conference
    f"{UNSPLASH}1524178232363-1fb2b075b655?w=1400&h=400&fit=crop",   # education
    f"{UNSPLASH}1559136555-9303baea8ebd?w=1400&h=400&fit=crop",     # finance
    f"{UNSPLASH}1473341304170-971dccb5ac1e?w=1400&h=400&fit=crop",   # green energy
    f"{UNSPLASH}1550751827-4bd374c3f58b?w=1400&h=400&fit=crop",     # cybersecurity
    f"{UNSPLASH}1460925895917-afdab827c52f?w=1400&h=400&fit=crop",   # marketing
    f"{UNSPLASH}1485827404703-89b55fcc595e?w=1400&h=400&fit=crop",   # data science
    f"{UNSPLASH}1519389950473-47ba0277781c?w=1400&h=400&fit=crop",   # innovation
    f"{UNSPLASH}1451187580459-43490279c0fa?w=1400&h=400&fit=crop",   # cloud summit
# Marketplace product templates by stand category
# (name, description, price_usd, image_url, initial_stock)
PRODUCT_CATALOG = {
    "Technology": [
        ("Enterprise Platform License", "Annual license for our full-featured platform. Unlimited users, API access, custom integrations, and 24/7 priority support.", 2499.99, f"{UNSPLASH}1451187580459-43490279c0fa?w=400&h=300&fit=crop", 50),
        ("Developer SDK Pro", "Professional SDK with REST & GraphQL APIs, sandbox environment, code samples, and integration templates.", 899.99, f"{UNSPLASH}1461749280684-dccba630e2f6?w=400&h=300&fit=crop", 120),
        ("IoT Starter Kit", "Complete hardware + software bundle: 5 sensors, gateway, cloud dashboard, and 90-day data plan.", 349.99, f"{UNSPLASH}1518770660439-4636190af475?w=400&h=300&fit=crop", 200),
        ("Technical Workshop Pass", "2-hour hands-on workshop with our senior engineers. Includes lab access and certification.", 149.99, f"{UNSPLASH}1540575467063-178a50c2c397?w=400&h=300&fit=crop", 30),
        ("Branded Merchandise Pack", "Premium tech swag: t-shirt, notebook, stickers, USB drive, and wireless charger.", 49.99, f"{UNSPLASH}1607082349566-187342175e2f?w=400&h=300&fit=crop", 500),
    ],
    "Healthcare": [
        ("Clinical AI Module License", "12-month license for AI-assisted diagnostics. HIPAA-compliant, integrates with major EHR systems.", 4999.99, f"{UNSPLASH}1576091160399-112ba8d25d1d?w=400&h=300&fit=crop", 25),
        ("Telemedicine Starter Plan", "6-month subscription: HD video consultations, e-prescriptions, and patient portal.", 1299.99, f"{UNSPLASH}1576091160550-2173dba999ef?w=400&h=300&fit=crop", 100),
        ("Health Analytics Dashboard", "Real-time population health insights with customizable KPIs and export tools.", 799.99, f"{UNSPLASH}1551288049-bebda4e38f71?w=400&h=300&fit=crop", 80),
        ("Medical Device Demo Unit", "Evaluation unit of our connected wellness monitor. Includes 30-day cloud access.", 599.99, f"{UNSPLASH}1559757175-5700dde675bc?w=400&h=300&fit=crop", 15),
    ],
    "Education": [
        ("LMS Enterprise License", "Campus-wide learning management system. Unlimited courses, students, and SCORM support.", 3499.99, f"{UNSPLASH}1501504905252-473c47e087f8?w=400&h=300&fit=crop", 40),
        ("Virtual Classroom Suite", "Live video lectures, breakout rooms, quizzes, whiteboard, and recording.", 699.99, f"{UNSPLASH}1588702547923-7093a6c3ba33?w=400&h=300&fit=crop", 150),
        ("Student Analytics Module", "Track engagement, predict at-risk students, and generate automated reports.", 499.99, f"{UNSPLASH}1460925895917-afdab827c52f?w=400&h=300&fit=crop", 100),
    ],
    "Finance": [
        ("Fraud Detection Engine", "AI-powered real-time transaction monitoring. Catches 99.7 percent of fraudulent activity.", 5999.99, f"{UNSPLASH}1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop", 30),
        ("Blockchain Node License", "Enterprise node for our permissioned blockchain. 10K TPS, smart contract support.", 3999.99, f"{UNSPLASH}1639762681485-074b7f938ba0?w=400&h=300&fit=crop", 20),
        ("Risk Analytics Platform", "Portfolio risk modeling, stress testing, and regulatory compliance reporting.", 1999.99, f"{UNSPLASH}1642790106117-e829e14a795f?w=400&h=300&fit=crop", 50),
        ("Compliance Audit Toolkit", "Automated SOX/PCI-DSS audit trails, policy builder, and evidence collection.", 899.99, f"{UNSPLASH}1554224155-6726b3ff858f?w=400&h=300&fit=crop", 75),
    ],
    "Green Energy": [
        ("Solar Monitoring System", "IoT-based solar panel performance monitoring with predictive maintenance.", 1499.99, f"{UNSPLASH}1509391366360-2e959784a276?w=400&h=300&fit=crop", 60),
        ("Smart Grid Controller", "AI-optimized energy distribution controller for micro-grids and campuses.", 2999.99, f"{UNSPLASH}1473341304170-971dccb5ac1e?w=400&h=300&fit=crop", 25),
        ("Carbon Footprint Dashboard", "Track, report, and offset your organization carbon emissions in real-time.", 599.99, f"{UNSPLASH}1532601224476-15c79f2f7a51?w=400&h=300&fit=crop", 200),
    ],
    "AI & Data": [
        ("MLOps Platform License", "End-to-end ML lifecycle: training, versioning, deployment, and monitoring.", 3499.99, f"{UNSPLASH}1677442136019-21780ecad995?w=400&h=300&fit=crop", 40),
        ("GPU Training Credits (500 h)", "500 GPU-hours on our cloud cluster. Supports PyTorch, TensorFlow, and JAX.", 999.99, f"{UNSPLASH}1558494949-ef010cbdcc31?w=400&h=300&fit=crop", 300),
        ("Data Labeling Service Pack", "10,000 human-verified annotations for your CV/NLP datasets.", 499.99, f"{UNSPLASH}1504868584819-f8e8b4b6d7e3?w=400&h=300&fit=crop", 100),
        ("AI Ethics Certification Course", "Online certification in responsible AI. 20 hours of content plus exam.", 299.99, f"{UNSPLASH}1516321318423-f06f85e504b3?w=400&h=300&fit=crop", 500),
    ],
    "Engineering": [
        ("Kubernetes Enterprise Suite", "Multi-cluster management, GitOps, service mesh, and full observability stack.", 2999.99, f"{UNSPLASH}1667372393119-3d4c48d07fc9?w=400&h=300&fit=crop", 35),
        ("CI/CD Pipeline Template Pack", "20 production-ready pipeline templates for GitHub Actions, GitLab CI, and Jenkins.", 199.99, f"{UNSPLASH}1618401471353-b98afee0b2eb?w=400&h=300&fit=crop", 500),
        ("Cloud Migration Assessment", "Comprehensive audit of your infra with a migration roadmap and cost projection.", 1499.99, f"{UNSPLASH}1451187580459-43490279c0fa?w=400&h=300&fit=crop", 50),
        ("DevOps Bootcamp (5-day)", "Intensive bootcamp: containers, K8s, Terraform, monitoring. Remote or on-site.", 799.99, f"{UNSPLASH}1531482615713-2afd69097998?w=400&h=300&fit=crop", 40),
    ],
    "Cybersecurity": [
        ("Zero Trust Security Platform", "Identity-aware proxy, microsegmentation, and continuous verification engine.", 4999.99, f"{UNSPLASH}1555949963-ff9fe0c870eb?w=400&h=300&fit=crop", 20),
        ("Penetration Testing Package", "OWASP-compliant pentest for web, API, and mobile. Detailed report with remediation.", 2999.99, f"{UNSPLASH}1526374965328-7f61d4dc18c5?w=400&h=300&fit=crop", 30),
        ("SIEM Starter License", "Cloud-native SIEM with 90-day log retention, alerting, and threat intel feeds.", 1499.99, f"{UNSPLASH}1550751827-4bd374c3f58b?w=400&h=300&fit=crop", 50),
        ("Security Awareness Training", "Interactive e-learning for employees. Phishing simulations included.", 299.99, f"{UNSPLASH}1563986768609-322da13575f2?w=400&h=300&fit=crop", 1000),
    ],
}

# Enterprise-style event banners — strong thematic imagery per event
# EVENT_BANNERS = [
#     # 0 — Future Tech Expo: futuristic neon / digital grid
#     f"{UNSPLASH}1535223289827-42f1e9919769?w=1400&h=400&fit=crop",
#     # 1 — Healthcare Summit: medical lab / stethoscope
#     f"{UNSPLASH}1579684385127-1ef15d508118?w=1400&h=400&fit=crop",
#     # 2 — Education Expo: laptops in lecture hall
#     f"{UNSPLASH}1523050854058-8df90110c476?w=1400&h=400&fit=crop",
#     # 3 — FinTech Forum: stock trading screens
#     f"{UNSPLASH}1611974789855-9c2a0a7236a3?w=1400&h=400&fit=crop",
#     # 4 — Green Energy: solar panels at sunset
#     f"{UNSPLASH}1509391366360-2e959784a276?w=1400&h=400&fit=crop",
#     # 5 — Cybersecurity: code on dark screen
#     f"{UNSPLASH}1555949963-ff9fe0c870eb?w=1400&h=400&fit=crop",
#     # 6 — Digital Marketing: creative workspace
#     f"{UNSPLASH}1533750349088-cd871a92f312?w=1400&h=400&fit=crop",
#     # 7 — AI & Data Science: neural-network visualization
#     f"{UNSPLASH}1677442136019-21780ecad995?w=1400&h=400&fit=crop",
#     # 8 — Startup Hackathon: collaborative workspace
#     f"{UNSPLASH}1504384764586-bb4cdc1707b0?w=1400&h=400&fit=crop",
#     # 9 — Cloud Summit: glowing earth from space
#     f"{UNSPLASH}1451187580459-43490279c0fa?w=1400&h=400&fit=crop",
# ]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_id(doc: dict) -> dict:
    """Ensure doc has both 'id' and '_id' keys as strings."""
    if doc is None:
        return doc
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "id" not in doc and "_id" in doc:
        doc["id"] = doc["_id"]
    if "_id" not in doc and "id" in doc:
        doc["_id"] = str(doc["id"])
    return doc


def _random_tags(n=3):
    return random.sample(TAGS_POOL, min(n, len(TAGS_POOL)))


def _random_color():
    return random.choice(THEME_COLORS)


def _random_bg():
    return random.choice(STAND_BACKGROUNDS)


def _avatar_url(gender, idx):
    """Return a full-body transparent PNG of a standing business professional."""
    pool = PRESENTER_FULL_BODY.get(gender, PRESENTER_FULL_BODY["m"])
    return pool[idx % len(pool)]


# ─── Ensure functions (idempotent) ───────────────────────────────────────────

async def ensure_user(
    email: str, password: str, role: Role, full_name: str, username: str,
    bio: str = None, interests: list = None, language: str = "en",
    is_active: bool = True, approval_status: str = None,
) -> dict:
    existing = await get_user_by_email(email)
    if existing:
        return _normalize_id(existing)

    user = {
        "id": str(uuid4()),
        "email": email,
        "username": username,
        "full_name": full_name,
        "hashed_password": hash_password(password),
        "role": role,
        "is_active": is_active,
        "approval_status": approval_status,
        "created_at": NOW,
        "bio": bio,
        "language": language,
        "interests": interests or [],
    }
    await create_user(user)
    return _normalize_id(user)


async def ensure_event(
    title: str, description: str, organizer_id: str, target_state: EventState,
    category: str = "Exhibition", tags: list = None,
    start_date: datetime = None, end_date: datetime = None,
    num_enterprises: int = 5,
    stand_price: float = 300.0,
    is_paid: bool = False,
    ticket_price: float = None,
    banner_url: str = None,
) -> dict:
    events_col = get_events_collection()
    existing = await events_col.find_one({"title": title})
    if existing:
        existing = _normalize_id(existing)
        if existing.get("state") != target_state:
            await update_event_state(existing["id"], target_state)
            existing["state"] = target_state
        return existing

    # Build schedule from actual dates (one day per calendar day)
    sd = start_date or NOW
    ed = end_date or (NOW + timedelta(days=3))
    delta_days = max(1, (ed - sd).days + 1)

    _SLOT_TEMPLATES = [
        ("09:00", "12:00", "Opening ceremony & keynotes"),
        ("14:00", "17:00", "Workshop sessions & demos"),
        ("10:00", "13:00", "Networking & enterprise tours"),
        ("15:00", "18:00", "Closing presentations & awards"),
    ]
    sample_schedule = []
    for i in range(delta_days):
        day_date = sd + timedelta(days=i)
        label = day_date.strftime("%a %d %b")  # e.g. "Mon 24 Feb"
        t1, t2 = _SLOT_TEMPLATES[(i * 2) % len(_SLOT_TEMPLATES)], _SLOT_TEMPLATES[(i * 2 + 1) % len(_SLOT_TEMPLATES)]
        sample_schedule.append(
            ScheduleDay(
                day_number=i + 1,
                date_label=label,
                slots=[
                    ScheduleSlot(start_time=t1[0], end_time=t1[1], label=t1[2]),
                    ScheduleSlot(start_time=t2[0], end_time=t2[1], label=t2[2]),
                ],
            )
        )
    schedule_days_dict = [day.model_dump() for day in sample_schedule]
    timeline_json = json.dumps(schedule_days_dict)

    data = EventCreate(
        title=title,
        description=description,
        num_enterprises=num_enterprises,
        event_timeline=timeline_json,
        schedule_days=sample_schedule,
        extended_details=f"Comprehensive {category.lower()} event with demo exhibitors, workshops and networking sessions.",
        category=category,
        tags=tags or [],
        start_date=sd,
        end_date=ed,
        stand_price=stand_price,
        is_paid=is_paid,
        ticket_price=ticket_price if is_paid else None,
        banner_url=banner_url,
    )
    event = await create_event(data, organizer_id)
    event = _normalize_id(event)

    # Walk the state machine properly to populate all fields
    STATES_NEEDING_APPROVAL = {
        EventState.WAITING_FOR_PAYMENT,
        EventState.PAYMENT_DONE,
        EventState.APPROVED,
        EventState.LIVE,
        EventState.CLOSED,
    }
    STATES_NEEDING_PAYMENT = {
        EventState.PAYMENT_DONE,
        EventState.APPROVED,
        EventState.LIVE,
        EventState.CLOSED,
    }

    if target_state in STATES_NEEDING_APPROVAL:
        # approve_event -> sets payment_amount, state=WAITING_FOR_PAYMENT
        event = _normalize_id(await approve_event(event["id"]))

    if target_state in STATES_NEEDING_PAYMENT:
        # confirm_event_payment -> sets enterprise_link + visitor_link, state=PAYMENT_DONE
        event = _normalize_id(await confirm_event_payment(event["id"]))

    # If the final target differs from what the service left us at, force it
    if event.get("state") != target_state:
        event = _normalize_id(await update_event_state(event["id"], target_state))

    return event


async def ensure_stand(
    event_id: str, name: str, organization_id: str,
    description: str, tags: list[str],
    category: str = None, stand_type: str = "standard",
    theme_color: str = None, stand_background_url: str = None,
    presenter_name: str = None, presenter_avatar_url: str = None,
    logo_url: str = None,
) -> dict:
    stands_col = get_stands_collection()
    existing = await stands_col.find_one({"event_id": str(event_id), "name": name})
    if existing:
        # Patch avatar / background / logo when re-seeding with new URLs
        updates = {}
        if presenter_avatar_url and existing.get("presenter_avatar_url") != presenter_avatar_url:
            updates["presenter_avatar_url"] = presenter_avatar_url
        if stand_background_url and existing.get("stand_background_url") != stand_background_url:
            updates["stand_background_url"] = stand_background_url
        if logo_url and existing.get("logo_url") != logo_url:
            updates["logo_url"] = logo_url
        if updates:
            await stands_col.update_one({"_id": existing["_id"]}, {"$set": updates})
            existing.update(updates)
        return _normalize_id(existing)
    
    stand = await create_stand(
        event_id, organization_id, name,
        description=description, tags=tags, category=category,
        stand_type=stand_type,
        theme_color=theme_color or _random_color(),
        stand_background_url=stand_background_url or _random_bg(),
        presenter_name=presenter_name,
        presenter_avatar_url=presenter_avatar_url,
        logo_url=logo_url,
    )
    return _normalize_id(stand)


async def ensure_resource(stand_id: str, title: str, file_path: str, mime_type: str, rtype: str) -> dict:
    col = resource_repo.collection
    existing = await col.find_one({"stand_id": stand_id, "title": title})
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing
    payload = ResourceCreate(
        title=title,
        description=f"Sample {rtype} resource for demo and testing",
        stand_id=stand_id,
        type=rtype,
        tags=["demo", "seed"],
        file_path=file_path,
        file_size=random.randint(512, 10240),
        mime_type=mime_type,
    )
    return await resource_repo.create_resource(payload)


async def ensure_participation(event_id: str, user_id: str) -> dict:
    participants_col = get_participants_collection()
    existing = await participants_col.find_one(
        {"event_id": str(event_id), "user_id": str(user_id)}
    )
    if existing:
        if existing.get("status") != ParticipantStatus.APPROVED:
            await approve_participant(str(existing["_id"]))
        existing["_id"] = str(existing["_id"])
        return existing
    participant = await request_to_join(event_id, user_id)
    participant = _normalize_id(participant)
    approved = await approve_participant(participant["id"])
    return _normalize_id(approved)


async def ensure_notification(user_id: str, ntype: NotificationType, message: str) -> dict:
    col = get_notifications_collection()
    existing = await col.find_one({"user_id": str(user_id), "message": message})
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing
    return await create_notification(user_id, ntype, message)


async def ensure_favorite(user_id: str, target_type: str, target_id: str) -> dict:
    data = FavoriteCreate(target_type=target_type, target_id=str(target_id))
    return await create_favorite(str(user_id), data)


async def ensure_organization(name: str, description: str, owner_id: str) -> dict:
    orgs_col = get_organizations_collection()
    existing = await orgs_col.find_one({"name": name})
    if existing:
        return _normalize_id(existing)
    data = OrganizationCreate(name=name, description=description)
    org = await create_organization(data, owner_id)
    return _normalize_id(org)


async def ensure_chat_room_and_messages(
    user1_id: str, user2_id: str, user1_name: str, user2_name: str, messages: list[str]
) -> dict:
    room = await chat_repo.get_or_create_direct_room(str(user1_id), str(user2_id))
    room_id = str(room.id)

    # Check if messages already exist
    existing = await chat_repo.get_room_messages(room_id, limit=1)
    if existing:
        return {"room_id": room_id}

    for i, content in enumerate(messages):
        is_user1 = i % 2 == 0
        msg = {
            "room_id": room_id,
            "sender_id": str(user1_id if is_user1 else user2_id),
            "sender_name": user1_name if is_user1 else user2_name,
            "content": content,
            "type": "text",
            "timestamp": NOW - timedelta(minutes=len(messages) - i),
        }
        await chat_repo.create_message(msg)
    return {"room_id": room_id}


async def ensure_meeting(
    visitor_id: str, stand_id: str, purpose: str,
    start_offset_hours: int = 24, status: MeetingStatus = MeetingStatus.PENDING,
) -> dict:
    col = meeting_repo.collection
    existing = await col.find_one({"visitor_id": str(visitor_id), "stand_id": str(stand_id)})
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing

    start = NOW + timedelta(hours=start_offset_hours)
    end = start + timedelta(hours=1)
    meeting_data = MeetingCreate(
        visitor_id=str(visitor_id),
        stand_id=str(stand_id),
        start_time=start,
        end_time=end,
        purpose=purpose,
    )
    meeting = await meeting_repo.create_meeting(meeting_data)
    meeting = _normalize_id(meeting)

    if status != MeetingStatus.PENDING:
        update = MeetingUpdate(status=status, notes=f"Auto-seeded as {status.value}")
        updated = await meeting_repo.update_meeting_status(meeting["_id"], update)
        if updated:
            meeting = _normalize_id(updated)
    return meeting


async def ensure_lead_interaction(
    visitor_id: str, stand_id: str, interaction_type: str, metadata: dict = None
):
    interaction = LeadInteraction(
        visitor_id=str(visitor_id),
        stand_id=str(stand_id),
        interaction_type=interaction_type,
        metadata=metadata or {},
        timestamp=NOW - timedelta(minutes=random.randint(1, 1440)),
    )
    await lead_repo.log_interaction(interaction)



async def ensure_product(
    stand_id: str, name: str, description: str, price: float,
    image_url: str = "", stock: int = 50, currency: str = "usd",
) -> dict:
    """Idempotent: create a marketplace product for a stand."""
    db = get_database()
    sid = ObjectId(stand_id) if ObjectId.is_valid(str(stand_id)) else stand_id
    existing = await db.stand_products.find_one({"stand_id": sid, "name": name})
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing
    from app.modules.marketplace.service import create_product as _mkt_create
    data = {
        "name": name,
        "description": description,
        "price": price,
        "currency": currency,
        "image_url": image_url,
        "stock": stock,
    }
    return await _mkt_create(str(stand_id), data)

# ─── Main seed function ──────────────────────────────────────────────────────

async def main():
    await connect_to_mongo()
    print("=" * 60)
    print("  IVEP Comprehensive Data Seeding")
    print("=" * 60)

    # ──────────────────────────────────────────────────────────
    # 1. USERS
    # ──────────────────────────────────────────────────────────
    print("\n[1/10] Creating users...")

    admin = await ensure_user(
        "admin@demo.com", PASSWORD, Role.ADMIN, "Admin User", "admindemo",
        bio="Platform administrator", interests=["management", "analytics"],
    )
    print(f"  + Admin: {admin['email']}")

    # 10 Organizers
    organizer_data = [
        ("organizer@demo.com", "Organizer One", "orgdemo", "Event organizer and planner", ["events", "networking"]),
        ("sarah.org@demo.com", "Sarah Mitchell", "sarahmitchell", "Tech conference organizer", ["technology", "AI"]),
        ("james.org@demo.com", "James Wilson", "jameswilson", "Healthcare summit organizer", ["healthcare", "biotech"]),
        ("maria.org@demo.com", "Maria Garcia", "mariagarcia", "Education expo coordinator", ["education", "e-learning"]),
        ("alex.org@demo.com", "Alex Chen", "alexchen", "Fintech events manager", ["finance", "blockchain"]),
        ("emily.org@demo.com", "Emily Brown", "emilybrown", "Sustainability conference lead", ["green energy", "sustainability"]),
        ("david.org@demo.com", "David Kim", "davidkim", "Cybersecurity summit organizer", ["cybersecurity", "infosec"]),
        ("lisa.org@demo.com", "Lisa Johnson", "lisajohnson", "Marketing expo planner", ["marketing", "digital"]),
        ("ahmed.org@demo.com", "Ahmed Hassan", "ahmedhassan", "AI & Data conference lead", ["AI", "big data"]),
        ("nina.org@demo.com", "Nina Patel", "ninapatel", "Innovation hackathon organizer", ["innovation", "startups"]),
    ]
    organizers = []
    organizer_orgs = [
        # (org_name, org_type, country, city, phone, website, professional_email)
        ("Event Masters Pro", "Company", "France", "Paris", "+33 6 11 22 33 44", "https://eventmasters.fr", "contact@eventmasters.fr"),
        ("TechConf International", "Company", "USA", "San Francisco", "+1 415 555 0101", "https://techconf.io", "sarah@techconf.io"),
        ("HealthSummit Africa", "NGO", "Kenya", "Nairobi", "+254 700 123 456", "https://healthsummit.ke", "james@healthsummit.ke"),
        ("EduExpo Europe", "University", "Germany", "Berlin", "+49 30 12345678", "https://eduexpo.de", "maria@eduexpo.de"),
        ("FinTech Forum", "Company", "Singapore", "Singapore", "+65 6789 1234", "https://fintechforum.sg", "alex@fintechforum.sg"),
        ("Green Summit Organisation", "NGO", "Netherlands", "Amsterdam", "+31 20 123 4567", "https://greensummit.nl", "emily@greensummit.nl"),
        ("CyberDefense Council", "Government", "UK", "London", "+44 20 7946 0300", "https://cyberdefense.gov.uk", "david@cyberdefense.gov.uk"),
        ("Digital Marketing Alliance", "Association", "Canada", "Toronto", "+1 416 555 0199", "https://dma.ca", "lisa@dma.ca"),
        ("AI Research Collective", "University", "France", "Lyon", "+33 4 12 34 56 78", "https://airco.fr", "ahmed@airco.fr"),
        ("Innovation Hub", "Startup", "India", "Bangalore", "+91 80 1234 5678", "https://innovationhub.in", "nina@innovationhub.in"),
    ]
    users_col = get_database()["users"]
    for i, ((email, name, uname, bio, interests), (org_name, org_type, country, city, phone, website, prof_email)) in enumerate(zip(organizer_data, organizer_orgs)):
        # Last 2 organizers start as pending approval (for admin testing)
        is_pending = i >= 8
        o = await ensure_user(
            email, PASSWORD, Role.ORGANIZER, name, uname, bio=bio, interests=interests,
            is_active=not is_pending,
            approval_status="PENDING_APPROVAL" if is_pending else "APPROVED",
        )
        # Enrich with organizer profile fields
        if "_id" in o:
            oid = o["_id"]
            try:
                from bson import ObjectId as BsonObjectId
                q = {"_id": BsonObjectId(oid)} if BsonObjectId.is_valid(str(oid)) else {"_id": oid}
            except Exception:
                q = {"email": email}
            update_fields = {
                "org_name": org_name,
                "org_type": org_type,
                "org_country": country,
                "org_city": city,
                "org_phone": phone,
                "org_website": website,
                "org_professional_email": prof_email,
            }
            if not is_pending:
                update_fields["is_active"] = True
                update_fields["approval_status"] = "APPROVED"
            await users_col.update_one(q, {"$set": update_fields})
        organizers.append(o)
        status_label = "PENDING" if is_pending else "APPROVED"
        print(f"  + Organizer [{status_label}]: {o['email']} ({org_name})")

    # 10 Enterprise users
    enterprise_data = [
        ("enterprise1@demo.com", "TechCorp Lead", "techcorp1", "Enterprise technology solutions", ["cloud", "AI"]),
        ("enterprise2@demo.com", "CloudFirst Rep", "cloudfirst2", "Cloud infrastructure provider", ["cloud", "DevOps"]),
        ("enterprise3@demo.com", "HealthAI Manager", "healthai3", "AI-powered health diagnostics", ["healthcare", "AI"]),
        ("enterprise4@demo.com", "EduPlatform Lead", "eduplatform4", "Online education platform", ["education", "SaaS"]),
        ("enterprise5@demo.com", "FinSecure Rep", "finsecure5", "Financial security solutions", ["finance", "cybersecurity"]),
        ("enterprise6@demo.com", "GreenPower CEO", "greenpower6", "Renewable energy tech", ["green energy", "IoT"]),
        ("enterprise7@demo.com", "DataViz Lead", "dataviz7", "Data visualization tools", ["analytics", "big data"]),
        ("enterprise8@demo.com", "RoboTech Rep", "robotech8", "Robotic process automation", ["robotics", "automation"]),
        ("enterprise9@demo.com", "BlockChain Inc", "blockchain9", "Blockchain solutions provider", ["blockchain", "fintech"]),
        ("enterprise10@demo.com", "XReality Dev", "xreality10", "Extended reality experiences", ["XR", "VR", "AR"]),
    ]
    enterprises = []
    for i, (email, name, uname, bio, interests) in enumerate(enterprise_data):
        # Last 2 enterprises start as pending approval (for admin testing)
        is_pending = i >= 8
        e = await ensure_user(
            email, PASSWORD, Role.ENTERPRISE, name, uname, bio=bio, interests=interests,
            is_active=not is_pending,
            approval_status="PENDING_APPROVAL" if is_pending else "APPROVED",
        )
        # Set approval_status on existing users too
        if "_id" in e:
            eid = e["_id"]
            try:
                q = {"_id": ObjectId(eid)} if ObjectId.is_valid(str(eid)) else {"_id": eid}
            except Exception:
                q = {"email": email}
            if is_pending:
                await users_col.update_one(q, {"$set": {
                    "is_active": False,
                    "approval_status": "PENDING_APPROVAL",
                }})
            else:
                await users_col.update_one(q, {"$set": {
                    "is_active": True,
                    "approval_status": "APPROVED",
                }})
        enterprises.append(e)
        status_label = "PENDING" if is_pending else "APPROVED"
        print(f"  + Enterprise [{status_label}]: {e['email']}")

    # 10 Visitors
    visitor_data = [
        ("visitor@demo.com", "Visitor User", "visdemo", "f", 1, "Tech enthusiast and event explorer", ["AI", "cloud"]),
        ("alice.vis@demo.com", "Alice Martin", "alicemartin", "f", 2, "Software developer seeking new tools", ["DevOps", "SaaS"]),
        ("bob.vis@demo.com", "Bob Thompson", "bobthompson", "m", 3, "Healthcare professional exploring tech", ["healthcare", "biotech"]),
        ("carol.vis@demo.com", "Carol Davis", "caroldavis", "f", 4, "EdTech startup founder", ["education", "AI"]),
        ("daniel.vis@demo.com", "Daniel Lee", "daniellee", "m", 5, "Data scientist and ML engineer", ["ML", "big data"]),
        ("eva.vis@demo.com", "Eva Novak", "evanovak", "f", 6, "Cybersecurity analyst", ["cybersecurity", "cloud"]),
        ("frank.vis@demo.com", "Frank Miller", "frankmiller", "m", 7, "Sustainability consultant", ["green energy", "IoT"]),
        ("grace.vis@demo.com", "Grace Wang", "gracewang", "f", 8, "Product manager at a startup", ["SaaS", "analytics"]),
        ("henry.vis@demo.com", "Henry Clark", "henryclark", "m", 9, "Blockchain developer", ["blockchain", "fintech"]),
        ("iris.vis@demo.com", "Iris Yamamoto", "irisyamamoto", "f", 10, "XR content creator", ["XR", "VR", "AR"]),
    ]
    visitors = []
    for email, name, uname, gender, idx, bio, interests in visitor_data:
        v = await ensure_user(
            email, PASSWORD, Role.VISITOR, name, uname,
            bio=bio, interests=interests,
        )
        visitors.append(v)
        print(f"  + Visitor: {v['email']}")

    print(f"  Total users: 1 admin + {len(organizers)} organizers + {len(enterprises)} enterprises + {len(visitors)} visitors")

    # ──────────────────────────────────────────────────────────
    # 2. ORGANIZATIONS (one per enterprise)
    # ──────────────────────────────────────────────────────────
    print("\n[2/10] Creating organizations...")

    org_definitions = [
        ("TechCorp Solutions", "Leading enterprise technology solutions provider"),
        ("CloudFirst Inc", "Cloud infrastructure and platform engineering"),
        ("HealthAI Labs", "AI-powered health diagnostics and research"),
        ("EduPlatform Global", "Next-generation online education platform"),
        ("FinSecure Systems", "Financial technology and security solutions"),
        ("GreenPower Tech", "Renewable energy and smart grid solutions"),
        ("DataViz Studio", "Advanced data visualization and analytics tools"),
        ("RoboTech Automation", "Robotic process automation and AI"),
        ("BlockChain Dynamics", "Enterprise blockchain and DeFi solutions"),
        ("XReality Studios", "Extended reality content and experiences"),
    ]

    organizations = []
    for i, (org_name, org_desc) in enumerate(org_definitions):
        org = await ensure_organization(org_name, org_desc, enterprises[i]["_id"])
        organizations.append(org)
        print(f"  + Organization: {org_name}")

    # ──────────────────────────────────────────────────────────
    # 3. EVENTS (10 events across all lifecycle states)
    # ──────────────────────────────────────────────────────────
    print("\n[3/10] Creating events...")

    event_definitions = [
        # (title, desc, org_idx, state, category, tags, num_ent, start_off, dur, stand_price, is_paid, ticket_price, banner_url)
        (
            "Future Tech Expo 2026",
            "Experience AI, cloud, and XR demos across virtual stands. The premier tech exhibition of the year.",
            0, EventState.LIVE, "Technology", ["AI", "Cloud", "XR"], 8, -1, 5, 500.0, True, 30.0, EVENT_BANNERS[0],
        ),
        (
            "Healthcare Innovations Summit",
            "Cutting-edge digital health, biotech, and telemedicine innovations.",
            2, EventState.LIVE, "Healthcare", ["HealthTech", "Biotech", "AI"], 6, -2, 4, 450.0, True, 20.0, EVENT_BANNERS[1],
        ),
        (
            "Global Education Expo",
            "Transforming education through technology — from K12 to lifelong learning.",
            3, EventState.APPROVED, "Education", ["EdTech", "AI", "No-Code"], 5, 7, 3, 300.0, False, None, EVENT_BANNERS[2],
        ),
        (
            "FinTech World Forum",
            "Blockchain, DeFi, and next-gen banking solutions showcase.",
            4, EventState.APPROVED, "Finance", ["FinTech", "Blockchain", "Cybersecurity"], 7, 10, 4, 600.0, True, 50.0, EVENT_BANNERS[3],
        ),
        (
            "Green Energy Conference",
            "Sustainability, smart grids, and renewable energy technologies.",
            5, EventState.PAYMENT_DONE, "Green Energy", ["GreenTech", "IoT", "Sustainability"], 5, 14, 3, 350.0, False, None, EVENT_BANNERS[4],
        ),
        (
            "Cybersecurity Defense Summit",
            "Zero trust, threat intelligence, and SOC modernization.",
            6, EventState.WAITING_FOR_PAYMENT, "Cybersecurity", ["Cybersecurity", "Cloud", "AI"], 6, 20, 3, 550.0, True, 40.0, EVENT_BANNERS[5],
        ),
        (
            "Digital Marketing Masterclass",
            "SEO, content strategy, and marketing automation tools exhibition.",
            7, EventState.PENDING_APPROVAL, "Marketing", ["Marketing", "Analytics", "SaaS"], 4, 28, 2, 250.0, False, None, EVENT_BANNERS[6],
        ),
        (
            "AI & Data Science Conference",
            "Deep learning, NLP, computer vision, and MLOps — the data revolution.",
            8, EventState.LIVE, "AI & Data", ["AI", "ML", "Big Data", "Analytics"], 10, -3, 6, 700.0, True, 60.0, EVENT_BANNERS[7],
        ),
        (
            "Startup Innovation Hackathon",
            "48-hour hackathon with pitches, demos, and investor networking.",
            9, EventState.APPROVED, "Technology", ["Innovation", "Startups", "No-Code"], 5, 5, 2, 200.0, False, None, EVENT_BANNERS[8],
        ),
        (
            "Enterprise Cloud Summit",
            "Multi-cloud strategies, containerization, and serverless architectures.",
            1, EventState.LIVE, "Engineering", ["Cloud", "DevOps", "Kubernetes"], 8, -1, 4, 480.0, True, 35.0, EVENT_BANNERS[9],
        ),
    ]

    events = []
    for title, desc, org_idx, state, cat, tags, num_ent, start_off, dur, sp, paid, tp, banner in event_definitions:
        ev = await ensure_event(
            title=title,
            description=desc,
            organizer_id=organizers[org_idx]["_id"],
            target_state=state,
            category=cat,
            tags=tags,
            start_date=NOW + timedelta(days=start_off),
            end_date=NOW + timedelta(days=start_off + dur),
            num_enterprises=num_ent,
            stand_price=sp,
            is_paid=paid,
            ticket_price=tp,
            banner_url=banner,
        )
        events.append(ev)
        print(f"  + Event: {title} [{state.value}] | stand ${sp} | {'paid $' + str(tp) if paid else 'free'}")

    # Identify live / approved events for stand and participation seeding
    live_events = [e for e in events if e.get("state") == EventState.LIVE]
    accessible_events = [e for e in events if e.get("state") in (
        EventState.LIVE, EventState.APPROVED, EventState.PAYMENT_DONE,
    )]

    # ──────────────────────────────────────────────────────────
    # 4. STANDS (3-5 per live/approved event = 30+ stands)
    # ──────────────────────────────────────────────────────────
    print("\n[4/10] Creating stands...")

    # (event_idx, org_idx, name, desc, tags, category, stand_type, presenter_name, presenter_gender, presenter_idx)
    stand_definitions = [
        # Event 0: Future Tech Expo 2026 (LIVE)
        (0, 0, "AI Innovations Hub", "Showcasing applied AI products for enterprises.", ["AI", "ML", "Enterprise"], "Technology", "sponsor", "Dr. Alex Rivera", "m", 11),
        (0, 1, "Cloud Native Platform", "Kubernetes, observability, and platform engineering demos.", ["Cloud", "DevOps", "Kubernetes"], "Engineering", "premium", "Jordan Blake", "m", 12),
        (0, 9, "XR Experience Zone", "Immersive VR/AR demonstrations and content showcase.", ["XR", "VR", "AR"], "Technology", "sponsor", "Maya Chen", "f", 13),
        (0, 6, "DataViz Dashboard", "Interactive data visualization and BI tools demo.", ["Analytics", "Big Data"], "AI & Data", "standard", "Sam Patel", "m", 14),
        (0, 7, "RoboTech Arena", "Live robotic process automation demonstrations.", ["Robotics", "Automation", "AI"], "Technology", "premium", "Lisa Zhang", "f", 15),

        # Event 1: Healthcare Innovations Summit (LIVE)
        (1, 2, "HealthAI Diagnostics", "AI-powered diagnostic imaging and patient analytics.", ["Healthcare", "AI", "Diagnostics"], "Healthcare", "sponsor", "Dr. Sarah Kim", "f", 16),
        (1, 0, "MedTech Solutions", "Electronic health records and telemedicine platform.", ["HealthTech", "SaaS"], "Healthcare", "premium", "Michael Torres", "m", 17),
        (1, 6, "Health Analytics Lab", "Population health data visualization.", ["Analytics", "Healthcare"], "Healthcare", "standard", "Emily Watson", "f", 18),

        # Event 2: Global Education Expo (APPROVED)
        (2, 3, "EduPlatform Showcase", "Interactive online learning platform demonstration.", ["EdTech", "AI", "E-learning"], "Education", "sponsor", "Prof. David Lee", "m", 19),
        (2, 0, "TechEd Solutions", "Technology-enhanced classroom tools.", ["Education", "SaaS"], "Education", "standard", "Anna Roberts", "f", 20),
        (2, 6, "Learning Analytics", "Student performance tracking and insights.", ["Analytics", "EdTech"], "Education", "standard", "Chris Park", "m", 21),

        # Event 3: FinTech World Forum (APPROVED)
        (3, 4, "FinSecure Vault", "Next-gen financial security and fraud detection.", ["FinTech", "Cybersecurity"], "Finance", "sponsor", "Robert Chen", "m", 22),
        (3, 8, "BlockChain Hub", "Enterprise blockchain and smart contract demos.", ["Blockchain", "DeFi"], "Finance", "premium", "Sophia Adams", "f", 23),
        (3, 0, "Digital Banking Suite", "Core banking modernization platform.", ["FinTech", "Cloud"], "Finance", "standard", "James Liu", "m", 24),

        # Event 4: Green Energy Conference (PAYMENT_DONE)
        (4, 5, "GreenPower Station", "Solar, wind, and smart grid technology showcase.", ["GreenTech", "IoT"], "Green Energy", "sponsor", "Dr. Nina Green", "f", 25),
        (4, 0, "Smart Grid Tech", "IoT-enabled smart grid management systems.", ["IoT", "Analytics"], "Green Energy", "standard", "Tom Wilson", "m", 26),

        # Event 7: AI & Data Science Conference (LIVE)
        (7, 0, "TechCorp AI Lab", "Enterprise AI research and MLOps platform.", ["AI", "ML", "MLOps"], "AI & Data", "sponsor", "Dr. Raj Patel", "m", 27),
        (7, 6, "DataViz Pro", "Advanced data visualization for data scientists.", ["Analytics", "Big Data", "ML"], "AI & Data", "premium", "Sophie Martin", "f", 28),
        (7, 2, "NLP Research Station", "Natural language processing breakthroughs.", ["AI", "NLP"], "AI & Data", "standard", "Alex Thompson", "m", 29),
        (7, 7, "AutoML Arena", "Automated machine learning platform demos.", ["ML", "AutoML", "AI"], "AI & Data", "standard", "Kelly Wang", "f", 30),

        # Event 8: Startup Innovation Hackathon (APPROVED)
        (8, 9, "XR Startup Pavilion", "XR technology startup demonstrations.", ["XR", "VR", "Startups"], "Technology", "standard", "Leo Huang", "m", 31),
        (8, 3, "EdTech Innovators", "Education technology startup showcases.", ["EdTech", "Innovation"], "Education", "standard", "Maria Santos", "f", 32),

        # Event 9: Enterprise Cloud Summit (LIVE)
        (9, 1, "CloudFirst Demo Hub", "Multi-cloud and hybrid cloud solutions.", ["Cloud", "DevOps"], "Engineering", "sponsor", "Ryan Miller", "m", 33),
        (9, 0, "Container Orchestration", "Kubernetes and container management platform.", ["Kubernetes", "Cloud", "DevOps"], "Engineering", "premium", "Amy Chen", "f", 34),
        (9, 7, "Serverless Workshop", "Serverless computing and FaaS demonstrations.", ["Cloud", "Serverless"], "Engineering", "standard", "Jake Brown", "m", 35),
        (9, 4, "Cloud Security Zone", "Cloud-native security and compliance tools.", ["Cloud", "Cybersecurity"], "Engineering", "premium", "Diana Ross", "f", 36),

        # Event 5: Cybersecurity Defense Summit (WAITING_FOR_PAYMENT)
        (5, 4, "Zero Trust Architecture", "Zero trust security implementation demos.", ["Cybersecurity", "Cloud"], "Cybersecurity", "sponsor", "Mark Stevens", "m", 37),
        (5, 0, "Threat Intelligence Lab", "Real-time threat detection and response.", ["Cybersecurity", "AI"], "Cybersecurity", "premium", "Julia Lee", "f", 38),

        # ── Additional stands for LIVE events (pagination testing) ──────────

        # Event 0: Future Tech Expo 2026 (LIVE) — 7 more
        (0, 2, "HealthTech Crossover", "Where healthcare meets consumer technology.", ["HealthTech", "IoT", "Wearables"], "Healthcare", "standard", "Dr. Mia Torres", "f", 39),
        (0, 3, "EdTech Pioneers Lab", "Gamified learning and adaptive education tools.", ["EdTech", "AI", "Gamification"], "Education", "standard", "Prof. Noah Kim", "m", 40),
        (0, 4, "FinTech Frontiers", "Next-generation payment and lending platforms.", ["FinTech", "Blockchain", "Mobile"], "Finance", "premium", "Layla Ahmed", "f", 41),
        (0, 5, "GreenTech Pavilion", "Sustainable technology showcases and demos.", ["GreenTech", "IoT", "Sustainability"], "Green Energy", "standard", "Tom Green", "m", 42),
        (0, 8, "Quantum Computing Lab", "Hands-on quantum computing demonstrations.", ["Quantum", "AI", "Research"], "Technology", "sponsor", "Dr. Wei Zhang", "m", 43),

        # Event 1: Healthcare Innovations Summit (LIVE) — 7 more
        (1, 3, "Digital Therapeutics Lab", "Software-based treatments and wellness apps.", ["HealthTech", "SaaS", "Wellness"], "Healthcare", "standard", "Dr. Emma Liu", "f", 46),
        (1, 4, "PharmaTech Solutions", "Drug discovery AI and clinical trial platforms.", ["Biotech", "AI", "Pharma"], "Healthcare", "premium", "Dr. James Park", "m", 47),
        (1, 5, "MedDevice Innovations", "Connected medical device demonstrations.", ["IoT", "Healthcare", "Wearables"], "Healthcare", "standard", "Nurse Sarah Bell", "f", 48),
        (1, 7, "TeleMed Connect", "Remote patient monitoring and video consultation.", ["HealthTech", "Cloud", "Telehealth"], "Healthcare", "premium", "Dr. Raj Gupta", "m", 49),
        (1, 8, "BioAI Research Hub", "Genomics, proteomics, and AI-driven research.", ["Biotech", "AI", "Genomics"], "Healthcare", "sponsor", "Dr. Nina Yoshida", "f", 50),
        (1, 9, "Mental Health Tech", "Digital mental health tools and AI therapy bots.", ["HealthTech", "AI", "Wellness"], "Healthcare", "standard", "Dr. Liam O'Brien", "m", 51),
        (1, 1, "Cloud Health Platform", "HIPAA-compliant cloud infrastructure for health.", ["Cloud", "Healthcare", "Security"], "Healthcare", "standard", "Amy Schneider", "f", 52),

        # Event 7: AI & Data Science Conference (LIVE) — 6 more
        (7, 1, "Cloud ML Ops Center", "End-to-end ML pipelines on multi-cloud.", ["Cloud", "ML", "MLOps"], "AI & Data", "standard", "Ryan Peters", "m", 53),
        (7, 3, "AI in Education", "Personalized learning through AI and analytics.", ["AI", "EdTech", "Analytics"], "Education", "standard", "Dr. Laura Chen", "f", 54),
        (7, 4, "Fraud Detection AI", "Real-time financial fraud detection models.", ["AI", "FinTech", "Cybersecurity"], "Finance", "premium", "Ahmed Karim", "m", 55),
        (7, 5, "Green AI Lab", "Energy-efficient model training and inference.", ["AI", "GreenTech", "Sustainability"], "Green Energy", "standard", "Mika Tanaka", "f", 56),
        (7, 8, "Conversational AI Hub", "Chatbots, voice assistants, and dialog systems.", ["AI", "NLP", "SaaS"], "AI & Data", "premium", "Chris Rodriguez", "m", 57),
        (7, 9, "Computer Vision Arena", "Real-time object detection and video analytics.", ["AI", "Computer Vision", "IoT"], "AI & Data", "sponsor", "Priya Sharma", "f", 58),

        # Event 9: Enterprise Cloud Summit (LIVE) — 6 more
        (9, 2, "Health Cloud Infra", "HIPAA-compliant cloud for healthcare workloads.", ["Cloud", "Healthcare", "Security"], "Engineering", "standard", "Dr. Kevin Park", "m", 59),
        (9, 3, "EduCloud Platform", "Scalable cloud infrastructure for ed-tech.", ["Cloud", "EdTech", "SaaS"], "Engineering", "standard", "Sara Martinez", "f", 60),
        (9, 5, "Green Cloud Initiative", "Carbon-neutral data center strategies.", ["Cloud", "GreenTech", "Sustainability"], "Engineering", "standard", "Oliver Hansen", "m", 61),
        (9, 6, "Observability Suite", "Full-stack monitoring, tracing, and logging.", ["DevOps", "Cloud", "Analytics"], "Engineering", "premium", "Tina Nguyen", "f", 62),
        (9, 8, "Edge Computing Hub", "Edge deployment, IoT gateways, and 5G infra.", ["Cloud", "IoT", "5G"], "Engineering", "sponsor", "Marco Silva", "m", 63),
        (9, 9, "Cloud Migration Lab", "Lift-and-shift to cloud-native transformation.", ["Cloud", "DevOps", "Migration"], "Engineering", "standard", "Kate Williams", "f", 64),
    ]

    all_stands = []
    for ev_idx, org_idx, name, desc, tags, cat, stype, pname, pgender, pidx in stand_definitions:
        stand = await ensure_stand(
            event_id=events[ev_idx]["_id"],
            name=name,
            organization_id=organizations[org_idx]["_id"],
            description=desc,
            tags=tags,
            category=cat,
            stand_type=stype,
            theme_color=_random_color(),
            stand_background_url=_random_bg(),
            presenter_name=pname,
            presenter_avatar_url=_avatar_url(pgender, pidx),
            logo_url=UI_AVATARS.format(name=name.replace(" ", "+"), bg=_random_color().lstrip("#")),
        )
        all_stands.append((ev_idx, stand))
        print(f"  + Stand: {name} @ {events[ev_idx]['title'][:35]}")

    print(f"  Total stands: {len(all_stands)}")

    # ──────────────────────────────────────────────────────────
    # 4b. MARKETPLACE PRODUCTS (for stands in live/approved events)
    # ──────────────────────────────────────────────────────────
    print("\n[4b] Seeding marketplace products...")

    product_count = 0
    for ev_idx, stand in all_stands:
        ev_state = events[ev_idx].get("state")
        # Only seed products for live & approved events
        if ev_state not in (EventState.LIVE, EventState.APPROVED):
            continue
        # ~30% of eligible stands don't sell anything (more realistic)
        if random.random() < 0.30:
            continue

        cat = stand.get("category", "Technology")
        templates = PRODUCT_CATALOG.get(cat, PRODUCT_CATALOG.get("Technology", []))
        if not templates:
            continue
        num = random.randint(2, min(4, len(templates)))
        chosen = random.sample(templates, num)

        for pname, pdesc, pprice, pimg, pstock in chosen:
            await ensure_product(stand["_id"], pname, pdesc, pprice, pimg, pstock)
            product_count += 1

    print(f"  Marketplace products: {product_count}")

    # ──────────────────────────────────────────────────────────
    # 5. RESOURCES (2-4 per stand)
    # ──────────────────────────────────────────────────────────
    print("\n[5/10] Creating resources...")

    resource_templates = [
        ("{stand} Brochure.pdf", "/uploads/resources/{slug}-brochure.pdf", "application/pdf", "pdf"),
        ("{stand} Product Demo.mp4", "/uploads/resources/{slug}-demo.mp4", "video/mp4", "video"),
        ("{stand} Overview.pdf", "/uploads/resources/{slug}-overview.pdf", "application/pdf", "pdf"),
        ("{stand} Infographic.png", "/uploads/resources/{slug}-infographic.png", "image/png", "image"),
        ("{stand} Whitepaper.pdf", "/uploads/resources/{slug}-whitepaper.pdf", "application/pdf", "pdf"),
        ("{stand} Case Study.pdf", "/uploads/resources/{slug}-casestudy.pdf", "application/pdf", "document"),
    ]

    resource_count = 0
    for _, stand in all_stands:
        slug = stand["name"].lower().replace(" ", "-")
        num_resources = random.randint(2, 4)
        chosen_templates = random.sample(resource_templates, num_resources)
        for title_tpl, path_tpl, mime, rtype in chosen_templates:
            title = title_tpl.format(stand=stand["name"])
            path = path_tpl.format(slug=slug)
            await ensure_resource(stand["_id"], title, path, mime, rtype)
            resource_count += 1

    print(f"  Total resources: {resource_count}")

    # ──────────────────────────────────────────────────────────
    # 6. PARTICIPATIONS (visitors join live/approved events)
    # ──────────────────────────────────────────────────────────
    print("\n[6/10] Creating participations...")

    participation_count = 0

    # All visitors join all LIVE events
    for ev in live_events:
        for visitor in visitors:
            await ensure_participation(ev["id"], visitor["id"])
            participation_count += 1

    # First 5 visitors also join approved events
    for ev in [e for e in events if e.get("state") == EventState.APPROVED]:
        for visitor in visitors[:5]:
            await ensure_participation(ev["id"], visitor["id"])
            participation_count += 1

    # Some enterprise users also participate in live events
    for ev in live_events[:2]:
        for ent in enterprises[:3]:
            await ensure_participation(ev["id"], ent["id"])
            participation_count += 1

    print(f"  Total participations: {participation_count}")

    # ──────────────────────────────────────────────────────────
    # 7. FAVORITES & NOTIFICATIONS
    # ──────────────────────────────────────────────────────────
    print("\n[7/10] Creating favorites & notifications...")

    fav_count = 0
    notif_count = 0

    # Each visitor favorites 2-4 random events + 1-3 random stands
    for visitor in visitors:
        # Favorite events
        fav_events = random.sample(events, min(random.randint(2, 4), len(events)))
        for ev in fav_events:
            await ensure_favorite(visitor["_id"], "event", ev["id"])
            fav_count += 1

        # Favorite stands from live events
        live_stands_list = [s for ei, s in all_stands if events[ei].get("state") == EventState.LIVE]
        if live_stands_list:
            fav_stands = random.sample(live_stands_list, min(random.randint(1, 3), len(live_stands_list)))
            for s in fav_stands:
                await ensure_favorite(visitor["_id"], "stand", s["id"])
                fav_count += 1

    # Notifications for all visitors
    notif_templates = [
        (NotificationType.PARTICIPANT_ACCEPTED, "You've been accepted to {event}! Explore the stands."),
        (NotificationType.EVENT_APPROVED, "{event} is now live -- check out the latest stands and resources."),
        (NotificationType.INVITATION_SENT, "You're invited to explore {event}. Don't miss out!"),
    ]

    for visitor in visitors:
        for ev in live_events:
            ntype, msg_tpl = random.choice(notif_templates)
            msg = msg_tpl.format(event=ev["title"])
            await ensure_notification(visitor["_id"], ntype, msg)
            notif_count += 1

    # Notifications for organizers about their events
    for i, org in enumerate(organizers[:5]):
        for ev in events[:3]:
            await ensure_notification(
                org["_id"],
                NotificationType.EVENT_APPROVED,
                f"Your event '{ev['title']}' has a status update.",
            )
            notif_count += 1

    # Payment notifications for organizers of WAITING/PAYMENT_DONE events
    for ev in events:
        if ev.get("state") in (EventState.WAITING_FOR_PAYMENT, EventState.PAYMENT_DONE):
            org_idx = next((i for i, (_, _, oi, *_) in enumerate(event_definitions) if oi == event_definitions[events.index(ev)][2]), 0)
            await ensure_notification(
                organizers[event_definitions[events.index(ev)][2]]["_id"],
                NotificationType.PAYMENT_REQUIRED,
                f"Payment required for '{ev['title']}'. Please complete payment to proceed.",
            )
            notif_count += 1

    print(f"  Favorites: {fav_count}, Notifications: {notif_count}")

    # ──────────────────────────────────────────────────────────
    # 8. MEETINGS (visitors book meetings at stands)
    # ──────────────────────────────────────────────────────────
    print("\n[8/10] Creating meetings...")

    meeting_count = 0
    meeting_purposes = [
        "Product demo and Q&A session",
        "Partnership discussion",
        "Technical deep-dive on architecture",
        "Career opportunities chat",
        "Investment pitch meeting",
        "Solution architecture review",
        "Integration planning session",
        "Pricing and licensing discussion",
    ]

    live_stands = [(ei, s) for ei, s in all_stands if events[ei].get("state") == EventState.LIVE]

    # Each visitor books 1-3 meetings with different stands
    for i, visitor in enumerate(visitors):
        num_meetings = random.randint(1, 3)
        chosen_stands = random.sample(live_stands, min(num_meetings, len(live_stands)))
        for j, (_, stand) in enumerate(chosen_stands):
            # Vary statuses: some pending, some approved, some completed
            statuses = [MeetingStatus.PENDING, MeetingStatus.APPROVED, MeetingStatus.COMPLETED]
            status = statuses[j % 3]
            purpose = random.choice(meeting_purposes)
            await ensure_meeting(
                visitor["_id"], stand["_id"], purpose,
                start_offset_hours=24 * (i + 1) + j * 2,
                status=status,
            )
            meeting_count += 1

    print(f"  Total meetings: {meeting_count}")

    # ──────────────────────────────────────────────────────────
    # 9. CHAT ROOMS & MESSAGES
    # ──────────────────────────────────────────────────────────
    print("\n[9/10] Creating chat rooms & messages...")

    chat_conversations = [
        [
            "Hi! I visited your AI Innovations stand -- very impressive demos.",
            "Thank you! We're glad you liked it. Any specific product you'd like to know more about?",
            "Yes, the ML pipeline tool caught my attention. Is there a free trial?",
            "Absolutely! I'll send you the trial link right after the event.",
            "Great, looking forward to it!",
        ],
        [
            "Hello, I have some questions about your cloud platform.",
            "Sure! What would you like to know?",
            "Can it integrate with our existing Kubernetes setup?",
            "Yes, we support all major K8s distributions. Let me schedule a technical deep-dive.",
            "That would be perfect, thanks!",
        ],
        [
            "Hi there! Your health diagnostics demo was fascinating.",
            "Thank you! It's our latest AI-powered imaging system.",
            "What kind of accuracy rates are you seeing?",
            "Over 95% for early detection in the categories we've trained on.",
            "Impressive. Can we set up a follow-up meeting?",
            "Of course! Let me check my availabilities.",
        ],
        [
            "Hey! I'm interested in your blockchain solution for supply chain.",
            "Great! Our smart contracts can track products from source to consumer.",
            "What's the transaction throughput?",
            "We process about 10,000 TPS on our private chain.",
        ],
        [
            "Your XR demo was mind-blowing! How do I get early access?",
            "Thanks! Sign up on our booth page and we'll add you to the beta list.",
            "Done! When can I expect access?",
            "Within the next two weeks. We'll notify you by email.",
        ],
        [
            "I was amazed by the data visualization capabilities at your stand.",
            "Thanks! Our real-time dashboards are our flagship product.",
            "Do you support custom widget development?",
            "Yes, we have a full SDK for building custom visualization components.",
            "That's exactly what we need. Can we explore an enterprise license?",
        ],
        [
            "Hi! The robotic automation demo was brilliant. What industries do you target?",
            "We focus on manufacturing, logistics, and healthcare currently.",
            "We're a logistics company, would love to discuss further.",
            "Perfect fit! Let's schedule a more detailed session.",
        ],
    ]

    chat_count = 0
    # Visitor <-> Enterprise chats
    for i, visitor in enumerate(visitors[:7]):
        if i < len(chat_conversations):
            ent = enterprises[i % len(enterprises)]
            await ensure_chat_room_and_messages(
                visitor["_id"], ent["_id"],
                visitor["full_name"], ent["full_name"],
                chat_conversations[i],
            )
            chat_count += 1

    # Visitor-to-visitor chats
    v2v_conversations = [
        [
            "Hey! Are you also attending the AI session tomorrow?",
            "Yes! Really looking forward to the NLP workshop.",
            "Same here. Want to grab a virtual coffee and discuss?",
            "Sure, let's connect after the session!",
        ],
        [
            "I saw your comment about cloud migration challenges.",
            "Yeah, it's been quite a journey for our team.",
            "We went through something similar -- happy to share our learnings.",
            "That would be super helpful, thanks!",
        ],
        [
            "This fintech expo has some great stands, right?",
            "Absolutely, the blockchain booth really stood out to me.",
            "Same! I also bookmarked the cloud security one.",
        ],
    ]

    for i in range(min(len(v2v_conversations), len(visitors) - 5)):
        await ensure_chat_room_and_messages(
            visitors[i]["_id"], visitors[i + 5]["_id"],
            visitors[i]["full_name"], visitors[i + 5]["full_name"],
            v2v_conversations[i],
        )
        chat_count += 1

    # Stand-scoped group chat rooms
    db = get_database()
    rooms_col = db["chat_rooms"]
    for _, stand in all_stands[:6]:
        existing = await rooms_col.find_one({"type": "stand", "name": f"{stand['name']} Chat"})
        if not existing:
            members = [v["_id"] for v in random.sample(visitors, min(5, len(visitors)))]
            room_doc = {
                "name": f"{stand['name']} Chat",
                "type": "stand",
                "members": members,
                "created_at": NOW,
                "last_message": {
                    "content": f"Welcome to the {stand['name']} discussion!",
                    "sender_name": "System",
                    "timestamp": NOW,
                },
            }
            await rooms_col.insert_one(room_doc)
            chat_count += 1

    print(f"  Total chat rooms: {chat_count}")

    # ──────────────────────────────────────────────────────────
    # 10. LEAD INTERACTIONS & ANALYTICS DATA
    # ──────────────────────────────────────────────────────────
    print("\n[10/10] Creating lead interactions & analytics...")

    lead_count = 0

    for visitor in visitors:
        # Each visitor interacts with 2-5 stands
        num_interactions = random.randint(2, 5)
        chosen_stands = random.sample(live_stands, min(num_interactions, len(live_stands)))
        for _, stand in chosen_stands:
            # Multiple interaction types per stand
            interactions = random.sample(INTERACTION_TYPES, random.randint(1, 3))
            for itype in interactions:
                metadata = {}
                if itype == "resource_download":
                    metadata["resource"] = f"{stand['name']} Brochure.pdf"
                elif itype == "chat":
                    metadata["duration_minutes"] = str(random.randint(2, 30))
                elif itype == "meeting":
                    metadata["meeting_type"] = random.choice(["demo", "discussion", "pitch"])
                await ensure_lead_interaction(visitor["_id"], stand["_id"], itype, metadata)
                lead_count += 1

    print(f"  Total lead interactions: {lead_count}")

    # Analytics events (direct collection insert)
    print("  Creating analytics events...")
    analytics_col = db["analytics_events"]
    analytics_count = 0

    for visitor in visitors:
        # Event views
        for ev in live_events:
            existing = await analytics_col.find_one({
                "type": "event_view",
                "user_id": visitor["_id"],
                "event_id": ev["id"],
            })
            if not existing:
                await analytics_col.insert_one({
                    "type": "event_view",
                    "user_id": visitor["_id"],
                    "event_id": ev["id"],
                    "created_at": NOW - timedelta(hours=random.randint(1, 72)),
                })
                analytics_count += 1

        # Stand visits
        for _, stand in random.sample(live_stands, min(4, len(live_stands))):
            existing = await analytics_col.find_one({
                "type": "stand_visit",
                "user_id": visitor["_id"],
                "stand_id": stand["_id"],
            })
            if not existing:
                await analytics_col.insert_one({
                    "type": "stand_visit",
                    "user_id": visitor["_id"],
                    "stand_id": stand["_id"],
                    "created_at": NOW - timedelta(hours=random.randint(1, 48)),
                })
                analytics_count += 1

        # Chat opened
        if random.random() > 0.5:
            await analytics_col.insert_one({
                "type": "chat_opened",
                "user_id": visitor["_id"],
                "created_at": NOW - timedelta(hours=random.randint(1, 24)),
            })
            analytics_count += 1

    print(f"  Total analytics events: {analytics_count}")

    # ──────────────────────────────────────────────────────────
    # 11. ENTERPRISE ORGANIZATION ENRICHMENT
    # ──────────────────────────────────────────────────────────
    print("\n[11/17] Enriching enterprise organizations...")

    org_enrichment = [
        # (org_idx, industry, country, city, company_size, website, description)
        (0, "Technology", "USA", "San Francisco", "201-500", "https://techcorp.example.com", "Enterprise AI & cloud solutions since 2010. Used by Fortune 500 companies."),
        (1, "Cloud Computing", "USA", "Seattle", "501-1000", "https://cloudfirst.example.com", "Pure-play cloud infra provider. Multi-cloud, hybrid, and edge deployments."),
        (2, "Healthcare Technology", "Germany", "Berlin", "51-200", "https://healthai.example.com", "Pioneering AI in healthcare diagnostics across 20 countries."),
        (3, "Education Technology", "UK", "London", "51-200", "https://eduplatform.example.com", "Next-gen adaptive learning platform serving 5M students globally."),
        (4, "Financial Technology", "Singapore", "Singapore", "201-500", "https://finsecure.example.com", "Securing digital financial transactions and fraud detection at scale."),
        (5, "Green Energy", "Netherlands", "Amsterdam", "11-50", "https://greenpower.example.com", "IoT-driven renewable energy management systems for smart cities."),
        (6, "Data & Analytics", "Canada", "Toronto", "11-50", "https://dataviz.example.com", "Real-time big data visualization and analytics dashboards."),
        (7, "Robotics & Automation", "Japan", "Tokyo", "51-200", "https://robotech.example.com", "Industrial RPA and collaborative robotics pioneer."),
        (8, "Blockchain", "Switzerland", "Zurich", "11-50", "https://blockchain.example.com", "Enterprise-grade blockchain infrastructure and DeFi solutions."),
        (9, "Extended Reality", "South Korea", "Seoul", "51-200", "https://xreality.example.com", "Immersive XR content for retail, training, and live events."),
    ]

    orgs_col = get_organizations_collection()
    for org_idx, industry, country, city, size, website, desc in org_enrichment:
        org_id = organizations[org_idx]["_id"]
        await orgs_col.update_one(
            {"_id": ObjectId(org_id)} if ObjectId.is_valid(str(org_id)) else {"_id": org_id},
            {"$set": {
                "type": "ENTERPRISE",
                "industry": industry,
                "country": country,
                "city": city,
                "company_size": size,
                "website": website,
                "description": desc,
                "theme_color": THEME_COLORS[org_idx],
            }},
        )
    print(f"  Enriched {len(org_enrichment)} enterprise organizations")

    # ──────────────────────────────────────────────────────────
    # 12. PRODUCTS & SERVICES (8-12 per enterprise)
    # ──────────────────────────────────────────────────────────
    print("\n[12/17] Creating products & services...")

    product_catalog = [
        # (enterprise_idx, org_idx, name, description, category, is_service, price, tags)
        # TechCorp (0)
        (0, 0, "AI Pipeline Studio", "End-to-end MLOps platform for model training and deployment.", "Software", False, 4999.0, ["AI", "MLOps", "Cloud"]),
        (0, 0, "Enterprise Analytics Suite", "Real-time business intelligence with AI-generated insights.", "Software", False, 2999.0, ["Analytics", "BI", "SaaS"]),
        (0, 0, "AI Consulting Package", "3-month AI strategy and implementation consulting.", "Consulting", True, 15000.0, ["AI", "Consulting"]),
        # CloudFirst (1)
        (1, 1, "CloudFirst Pro Plan", "Managed multi-cloud infrastructure with 99.99% SLA.", "Cloud", False, 1999.0, ["Cloud", "DevOps"]),
        (1, 1, "Kubernetes Management Platform", "Fully managed K8s clusters on any cloud.", "Software", False, 3499.0, ["Kubernetes", "Cloud"]),
        (1, 1, "Cloud Migration Service", "Complete lift-and-shift to cloud-native in 90 days.", "Consulting", True, 25000.0, ["Cloud", "Migration"]),
        # HealthAI (2)
        (2, 2, "AI Diagnostic Imaging Module", "FDA-cleared AI for radiology image analysis.", "Healthcare", False, 8999.0, ["Healthcare", "AI", "Diagnostics"]),
        (2, 2, "Patient Analytics Dashboard", "Population health management and predictive analytics.", "Software", False, 3999.0, ["Healthcare", "Analytics"]),
        (2, 2, "HealthAI Integration Services", "EHR integration and HL7 FHIR implementation.", "Consulting", True, 20000.0, ["Healthcare", "Integration"]),
        # EduPlatform (3)
        (3, 3, "Adaptive LMS Platform", "AI-powered learning management system with personalization.", "SaaS", False, 999.0, ["EdTech", "AI", "LMS"]),
        (3, 3, "Virtual Classroom Suite", "Live interactive classes with whiteboard and breakout rooms.", "SaaS", False, 599.0, ["EdTech", "Video"]),
        # FinSecure (4)
        (4, 4, "Fraud Detection Engine", "Real-time ML-based transaction fraud detection.", "Software", False, 5999.0, ["FinTech", "AI", "Security"]),
        (4, 4, "Compliance Automation Platform", "AML, KYC, and regulatory compliance automation.", "Software", False, 7999.0, ["FinTech", "Compliance"]),
        # GreenPower (5)
        (5, 5, "Smart Grid Monitor", "IoT-based renewable energy monitoring system.", "Hardware+Software", False, 12000.0, ["GreenTech", "IoT"]),
        (5, 5, "Energy Audit Consulting", "Comprehensive energy usage audit and optimization plan.", "Consulting", True, 5000.0, ["GreenTech", "Consulting"]),
        # DataViz (6)
        (6, 6, "DataViz Enterprise", "Self-service BI platform with 200+ chart types.", "Software", False, 1499.0, ["Analytics", "Visualization"]),
        (6, 6, "Real-time Streaming Dashboard", "Live data streaming and alerting dashboard.", "Software", False, 2499.0, ["Analytics", "Streaming"]),
        # RoboTech (7)
        (7, 7, "RPA Starter Pack", "Deploy your first 5 robotic automations in 30 days.", "Software", False, 8999.0, ["Robotics", "Automation"]),
        (7, 7, "Process Automation Audit", "Map and optimize business processes for RPA readiness.", "Consulting", True, 10000.0, ["Robotics", "Consulting"]),
        # BlockChain (8)
        (8, 8, "Enterprise Blockchain Node", "Managed private blockchain node with full API.", "Blockchain", False, 6999.0, ["Blockchain", "DeFi"]),
        (8, 8, "Smart Contract Development", "Custom smart contract design, audit, and deployment.", "Consulting", True, 18000.0, ["Blockchain", "Development"]),
        # XReality (9)
        (9, 9, "XR Event Platform", "Virtual event platform with immersive 3D environments.", "SaaS", False, 3999.0, ["XR", "Events", "VR"]),
        (9, 9, "AR Product Showcase Tool", "AR-powered product visualization for e-commerce.", "SaaS", False, 1999.0, ["AR", "E-commerce"]),
    ]

    db = get_database()
    products_col = db["products"]
    seeded_products = []
    for ent_idx, org_idx, name, desc, cat, is_service, price, tags in product_catalog:
        existing_prod = await products_col.find_one({
            "enterprise_id": enterprises[ent_idx]["_id"],
            "name": name,
        })
        if existing_prod:
            existing_prod["_id"] = str(existing_prod["_id"])
            seeded_products.append((ent_idx, org_idx, existing_prod))
            continue
        prod_doc = {
            "enterprise_id": enterprises[ent_idx]["_id"],
            "organization_id": organizations[org_idx]["_id"],
            "name": name,
            "description": desc,
            "category": cat,
            "is_service": is_service,
            "price": price,
            "tags": tags,
            "is_active": True,
            "created_at": NOW,
        }
        result = await products_col.insert_one(prod_doc)
        prod_doc["_id"] = str(result.inserted_id)
        seeded_products.append((ent_idx, org_idx, prod_doc))
        print(f"  + Product: {name} ({cat})")

    print(f"  Total products: {len(seeded_products)}")

    # ──────────────────────────────────────────────────────────
    # 13. PRODUCT REQUESTS (visitor -> enterprise, all statuses)
    # ──────────────────────────────────────────────────────────
    print("\n[13/17] Creating product requests...")

    requests_col = db["product_requests"]
    product_request_statuses = ["PENDING", "CONTACTED", "CLOSED"]
    product_request_messages = [
        "I'm very interested in your product. Could you share more details and pricing for 50 seats?",
        "We'd like to schedule a demo for our team. When are you available next week?",
        "Can you provide a case study for a company similar to ours in the logistics sector?",
        "What are the integration options with Salesforce and HubSpot?",
        "Is there a trial version available so our team can evaluate before committing?",
        "I watched the demo video and I'm impressed. What's the onboarding process like?",
        "We need a custom enterprise plan. Can you provide a quote for 500+ users?",
        "Our legal team needs your data processing agreement (DPA). Can you share it?",
    ]

    pr_count = 0
    for i, visitor in enumerate(visitors):
        # Each visitor sends 2-3 product requests to different enterprises
        num_requests = random.randint(2, 3)
        target_products = random.sample(seeded_products, min(num_requests, len(seeded_products)))
        for j, (ent_idx, org_idx, prod) in enumerate(target_products):
            existing_pr = await requests_col.find_one({
                "visitor_id": visitor["_id"],
                "product_id": prod["_id"],
            })
            if existing_pr:
                continue
            pr_status = product_request_statuses[(i + j) % len(product_request_statuses)]
            pr_doc = {
                "visitor_id": visitor["_id"],
                "enterprise_id": enterprises[ent_idx]["_id"],
                "organization_id": organizations[org_idx]["_id"],
                "product_id": prod["_id"],
                "message": random.choice(product_request_messages),
                "status": pr_status,
                "created_at": NOW - timedelta(hours=random.randint(2, 120)),
            }
            await requests_col.insert_one(pr_doc)
            pr_count += 1

    print(f"  Total product requests: {pr_count}")

    # ──────────────────────────────────────────────────────────
    # 14. ENTERPRISE EVENT JOIN RECORDS (all 4 statuses)
    # ──────────────────────────────────────────────────────────
    print("\n[14/17] Creating enterprise event join records...")

    participants_col = get_participants_collection()
    #
    # We create enterprise join records across live_events with all 4 statuses:
    # pending_payment, pending_admin_approval, approved, rejected
    # For "approved" ones we also create a stand (the auto-creation flow).
    #
    join_statuses = [
        ParticipantStatus.PENDING_PAYMENT,
        ParticipantStatus.PENDING_ADMIN_APPROVAL,
        ParticipantStatus.APPROVED,
        ParticipantStatus.REJECTED,
    ]

    ent_join_count = 0
    # Use enterprise 0-8 for cross-event join records
    # Enterprise 0-4 join live events 0 and 7; enterprise 5-9 join events 1 and 9
    ent_event_pairs = [
        # (ent_idx, event_idx, status_idx)
        (0, 0, 2),   # approved  -> stand auto-created
        (1, 0, 1),   # pending_admin_approval
        (2, 0, 0),   # pending_payment
        (3, 0, 3),   # rejected
        (4, 7, 2),   # approved  -> stand auto-created
        (5, 7, 1),   # pending_admin_approval
        (6, 1, 2),   # approved  -> stand auto-created
        (7, 1, 0),   # pending_payment
        (8, 9, 2),   # approved  -> stand auto-created
        (9, 9, 1),   # pending_admin_approval
    ]

    enterprise_approved_stands = []  # track for products linking

    for ent_idx, ev_idx, status_idx in ent_event_pairs:
        ent = enterprises[ent_idx]
        org = organizations[ent_idx]
        ev = events[ev_idx]
        pstatus = join_statuses[status_idx]

        existing_join = await participants_col.find_one({
            "event_id": str(ev["id"]),
            "organization_id": str(org["id"]),
            "role": "ENTERPRISE",
        })
        if existing_join:
            existing_join["_id"] = str(existing_join["_id"])
            if pstatus == ParticipantStatus.APPROVED:
                stand = await get_stands_collection().find_one({
                    "event_id": str(ev["id"]),
                    "organization_id": str(org["id"]),
                })
                if stand:
                    stand["_id"] = str(stand["_id"])
                    enterprise_approved_stands.append((ent_idx, stand))
            continue

        payment_ref = str(uuid4()) if status_idx >= 1 else None
        join_doc = {
            "event_id": str(ev["id"]),
            "organization_id": str(org["id"]),
            "user_id": str(ent["id"] or ent["_id"]),
            "role": "ENTERPRISE",
            "status": pstatus,
            "stand_fee_paid": status_idx >= 1,
            "payment_reference": payment_ref,
            "created_at": NOW - timedelta(days=random.randint(1, 14)),
        }
        if pstatus == ParticipantStatus.APPROVED:
            join_doc["approved_at"] = NOW - timedelta(days=random.randint(0, 7))
        if pstatus == ParticipantStatus.REJECTED:
            join_doc["rejected_at"] = NOW - timedelta(days=random.randint(0, 3))
            join_doc["rejection_reason"] = "Stand allocation full for this event."

        await participants_col.insert_one(join_doc)
        ent_join_count += 1

        # For APPROVED -> auto-create enterprise stand if not already there
        if pstatus == ParticipantStatus.APPROVED:
            existing_stand = await get_stands_collection().find_one({
                "event_id": str(ev["id"]),
                "organization_id": str(org["id"]),
            })
            if not existing_stand:
                new_stand = await create_stand(
                    event_id=str(ev["id"]),
                    organization_id=str(org["id"]),
                    name=f"{org.get('name', 'Enterprise')} Stand",
                    description=org.get("description", ""),
                    theme_color=THEME_COLORS[ent_idx],
                    stand_background_url=STAND_BACKGROUNDS[ent_idx % len(STAND_BACKGROUNDS)],
                    stand_type="premium",
                    logo_url=UI_AVATARS.format(
                        name=org.get("name", "Enterprise").replace(" ", "+"),
                        bg=THEME_COLORS[ent_idx].lstrip("#"),
                    ),
                )
                new_stand["_id"] = str(new_stand.get("_id", ""))
                enterprise_approved_stands.append((ent_idx, new_stand))
                print(f"  + Enterprise stand auto-created: {new_stand.get('name')} @ {ev.get('title', '')[:30]}")
            else:
                existing_stand["_id"] = str(existing_stand["_id"])
                enterprise_approved_stands.append((ent_idx, existing_stand))

        print(f"  + Enterprise join: {ent.get('email', '')} -> {ev.get('title', '')[:35]} [{pstatus}]")

    print(f"  Total enterprise join records: {ent_join_count}")

    # ──────────────────────────────────────────────────────────
    # 15. ENTERPRISE STAND — PRODUCTS LINKED
    # ──────────────────────────────────────────────────────────
    print("\n[15/17] Linking products to enterprise stands...")

    stands_col = get_stands_collection()
    linked_count = 0
    for ent_idx, ent_stand in enterprise_approved_stands:
        # Find products for this enterprise
        ent_products = [p for ei, oi, p in seeded_products if ei == ent_idx and p.get("is_active", True)]
        product_ids = [p["_id"] for p in ent_products[:3]]  # link up to 3 products per stand
        if not product_ids:
            continue
        s_id = ent_stand.get("_id") or ent_stand.get("id")
        try:
            await stands_col.update_one(
                {"_id": ObjectId(s_id)} if ObjectId.is_valid(str(s_id)) else {"_id": s_id},
                {"$set": {
                    "products": product_ids,
                    "rag_enabled": random.choice([True, False]),
                    "rag_last_indexed": NOW - timedelta(hours=random.randint(1, 48)) if random.random() > 0.5 else None,
                }},
            )
            linked_count += len(product_ids)
        except Exception as e:
            print(f"    (warn) Could not link products to stand {s_id}: {e}")

    print(f"  Linked {linked_count} product references to enterprise stands")

    # ──────────────────────────────────────────────────────────
    # 16. 2D HALL LAYOUT — STAND POSITIONS
    # ──────────────────────────────────────────────────────────
    print("\n[16/17] Seeding 2D hall layout positions...")

    # Each stand gets an x, y position + dimensions for the 2D hall view
    # Layout: stands are arranged in a grid-like layout per event
    # position: { x: col*200, y: row*150 } in pixels
    # booth_type determines visual rendering

    BOOTH_STYLES = [
        {"width": 180, "height": 120, "booth_type": "standard"},
        {"width": 240, "height": 150, "booth_type": "premium"},
        {"width": 300, "height": 180, "booth_type": "sponsor"},
    ]

    position_count = 0
    for ev_idx, stand in all_stands:
        s_id = stand.get("_id") or stand.get("id")
        existing = await stands_col.find_one(
            {"_id": ObjectId(s_id)} if ObjectId.is_valid(str(s_id)) else {"_id": s_id},
            projection={"hall_position": 1}
        )
        if existing and existing.get("hall_position"):
            continue  # already has position

        # calc position within event hall grid
        ev_stands_count = position_count % 12  # up to 12 stands per "row-group"
        col = ev_stands_count % 4
        row = ev_stands_count // 4
        stype = stand.get("stand_type", "standard")
        style = next((s for s in BOOTH_STYLES if s["booth_type"] == stype), BOOTH_STYLES[0])

        hall_pos = {
            "x": col * 260 + 40,
            "y": row * 200 + 60,
            "width": style["width"],
            "height": style["height"],
            "floor": 1,
            "zone": f"Zone-{chr(65 + col)}",  # Zone-A, Zone-B, Zone-C, Zone-D
        }

        try:
            await stands_col.update_one(
                {"_id": ObjectId(s_id)} if ObjectId.is_valid(str(s_id)) else {"_id": s_id},
                {"$set": {"hall_position": hall_pos}},
            )
            position_count += 1
        except Exception as e:
            pass  # non-critical

    # Also position enterprise stands
    for ent_idx, ent_stand in enterprise_approved_stands:
        s_id = ent_stand.get("_id") or ent_stand.get("id")
        existing = await stands_col.find_one(
            {"_id": ObjectId(s_id)} if ObjectId.is_valid(str(s_id)) else {"_id": s_id},
            projection={"hall_position": 1}
        )
        if existing and existing.get("hall_position"):
            continue
        hall_pos = {
            "x": (ent_idx % 4) * 260 + 200,
            "y": (ent_idx // 4) * 200 + 500,
            "width": 240,
            "height": 150,
            "floor": 2,  # Enterprise stands on floor 2
            "zone": "Enterprise-Zone",
        }
        try:
            await stands_col.update_one(
                {"_id": ObjectId(s_id)} if ObjectId.is_valid(str(s_id)) else {"_id": s_id},
                {"$set": {"hall_position": hall_pos}},
            )
            position_count += 1
        except Exception:
            pass

    print(f"  Positioned {position_count} stands in 2D hall")

    # ──────────────────────────────────────────────────────────
    # 17. ENTERPRISE NOTIFICATIONS
    # ──────────────────────────────────────────────────────────
    print("\n[17/17] Creating enterprise notifications...")

    ent_notif_count = 0
    for ent_idx, ev_idx, status_idx in ent_event_pairs:
        ent = enterprises[ent_idx]
        ev = events[ev_idx]
        pstatus = join_statuses[status_idx]

        if pstatus == ParticipantStatus.PENDING_PAYMENT:
            await ensure_notification(
                ent["_id"] if "_id" in ent else ent["id"],
                NotificationType.PAYMENT_REQUIRED,
                f"Your join request for '{ev['title']}' requires stand fee payment. Complete payment to proceed.",
            )
            ent_notif_count += 1

        elif pstatus == ParticipantStatus.PENDING_ADMIN_APPROVAL:
            await ensure_notification(
                ent["_id"] if "_id" in ent else ent["id"],
                NotificationType.INVITATION_SENT,
                f"Your payment for '{ev['title']}' is confirmed! Waiting for admin approval.",
            )
            ent_notif_count += 1

        elif pstatus == ParticipantStatus.APPROVED:
            await ensure_notification(
                ent["_id"] if "_id" in ent else ent["id"],
                NotificationType.PARTICIPANT_ACCEPTED,
                f"Congratulations! Your enterprise stand for '{ev['title']}' has been approved. Start configuring your stand now!",
            )
            ent_notif_count += 1

        elif pstatus == ParticipantStatus.REJECTED:
            await ensure_notification(
                ent["_id"] if "_id" in ent else ent["id"],
                NotificationType.EVENT_APPROVED,
                f"Your join request for '{ev['title']}' was not accepted this time. Stand allocation full for this event.",
            )
            ent_notif_count += 1

    # Visitor product request notifications
    for visitor in visitors[:5]:
        await ensure_notification(
            visitor["_id"] if "_id" in visitor else visitor["id"],
            NotificationType.INVITATION_SENT,
            "An enterprise has responded to your product inquiry. Check your messages!",
        )
        ent_notif_count += 1

    print(f"  Enterprise notifications: {ent_notif_count}")

    # ──────────────────────────────────────────────────────────
    # Summary
    # ──────────────────────────────────────────────────────────
    approved_count = len([e for e in events if e.get("state") == EventState.APPROVED])
    other_count = len(events) - len(live_events) - approved_count

    print("\n" + "=" * 60)
    print("  Seeding complete!")
    print("=" * 60)
    print(f"""
  Users:              1 admin + {len(organizers)} organizers + {len(enterprises)} enterprises + {len(visitors)} visitors
  Organizations:      {len(organizations)} (all enriched with type=ENTERPRISE)
  Events:             {len(events)} (LIVE: {len(live_events)}, APPROVED: {approved_count}, other: {other_count})
  Stands:             {len(all_stands)} organizer + {len(enterprise_approved_stands)} enterprise auto-created
  Resources:          {resource_count}
  Participations:     {participation_count} visitor + {ent_join_count} enterprise join records
  Products:           {len(seeded_products)}
  Product requests:   {pr_count}
  Favorites:          {fav_count}
  Notifications:      {notif_count} general + {ent_notif_count} enterprise
  Meetings:           {meeting_count}
  Chat rooms:         {chat_count}
  Lead interactions:  {lead_count}
  Analytics events:   {analytics_count}
  Mkt products:       {product_count}
  Hall positions:     {position_count} stands positioned

  2D Hall Layout: All stands have x/y/zone positions.
  Enterprise stands are on Floor 2 (zone: Enterprise-Zone).
  Regular stands are on Floor 1 (zones: Zone-A to Zone-D).

  Enterprise join statuses seeded:
    PENDING_PAYMENT -> enterprise3, enterprise8
    PENDING_ADMIN_APPROVAL -> enterprise2, enterprise6, enterprise10
    APPROVED (stand auto-created) -> enterprise1, enterprise5, enterprise7, enterprise9
    REJECTED -> enterprise4

  Account approval statuses:
    Pending Enterprise Accounts: enterprise9@demo.com, enterprise10@demo.com
    Pending Organizer Accounts: ahmed.org@demo.com, nina.org@demo.com
  Login credentials (all users share the same password):
  --------------------------------------------------------
    Password: {PASSWORD}

    Admin:       admin@demo.com
    Organizers:  organizer@demo.com, sarah.org@demo.com, james.org@demo.com,
                 maria.org@demo.com, alex.org@demo.com, emily.org@demo.com,
                 david.org@demo.com, lisa.org@demo.com, ahmed.org@demo.com,
                 nina.org@demo.com
    Enterprise:  enterprise1@demo.com .. enterprise10@demo.com
    Visitors:    visitor@demo.com, alice.vis@demo.com, bob.vis@demo.com,
                 carol.vis@demo.com, daniel.vis@demo.com, eva.vis@demo.com,
                 frank.vis@demo.com, grace.vis@demo.com, henry.vis@demo.com,
                 iris.vis@demo.com
    """)

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
