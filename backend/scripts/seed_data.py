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
import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from bson import ObjectId

from app.core.security import hash_password
from app.db.mongo import close_mongo_connection, connect_to_mongo, get_database
from app.modules.auth.enums import Role
from app.modules.events.schemas import EventCreate, EventState
from app.modules.events.service import (
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
    g = "women" if gender == "f" else "men"
    return f"{AVATAR_BASE}/{g}/{idx}.jpg"


# ─── Ensure functions (idempotent) ───────────────────────────────────────────

async def ensure_user(
    email: str, password: str, role: Role, full_name: str, username: str,
    bio: str = None, interests: list = None, language: str = "en",
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
        "is_active": True,
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
) -> dict:
    events_col = get_events_collection()
    existing = await events_col.find_one({"title": title})
    if existing:
        existing = _normalize_id(existing)
        if existing.get("state") != target_state:
            await update_event_state(existing["id"], target_state)
            existing["state"] = target_state
        return existing

    data = EventCreate(
        title=title,
        description=description,
        num_enterprises=num_enterprises,
        event_timeline="Day 1: Opening ceremony and keynotes. Day 2: Workshop sessions. Day 3: Closing and networking.",
        extended_details=f"Comprehensive {category.lower()} event with demo exhibitors, workshops and networking sessions.",
        category=category,
        tags=tags or [],
        start_date=start_date or NOW,
        end_date=end_date or (NOW + timedelta(days=3)),
    )
    event = await create_event(data, organizer_id)
    event = _normalize_id(event)
    if target_state != EventState.PENDING_APPROVAL:
        await update_event_state(event["id"], target_state)
        event["state"] = target_state
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
    for email, name, uname, bio, interests in organizer_data:
        o = await ensure_user(email, PASSWORD, Role.ORGANIZER, name, uname, bio=bio, interests=interests)
        organizers.append(o)
        print(f"  + Organizer: {o['email']}")

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
    for email, name, uname, bio, interests in enterprise_data:
        e = await ensure_user(email, PASSWORD, Role.ENTERPRISE, name, uname, bio=bio, interests=interests)
        enterprises.append(e)
        print(f"  + Enterprise: {e['email']}")

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
        # (title, description, organizer_idx, state, category, tags, num_enterprises, start_offset_days, duration_days)
        (
            "Future Tech Expo 2026",
            "Experience AI, cloud, and XR demos across virtual stands. The premier tech exhibition of the year.",
            0, EventState.LIVE, "Technology", ["AI", "Cloud", "XR"], 8, -1, 5,
        ),
        (
            "Healthcare Innovations Summit",
            "Cutting-edge digital health, biotech, and telemedicine innovations.",
            2, EventState.LIVE, "Healthcare", ["HealthTech", "Biotech", "AI"], 6, -2, 4,
        ),
        (
            "Global Education Expo",
            "Transforming education through technology — from K12 to lifelong learning.",
            3, EventState.APPROVED, "Education", ["EdTech", "AI", "No-Code"], 5, 7, 3,
        ),
        (
            "FinTech World Forum",
            "Blockchain, DeFi, and next-gen banking solutions showcase.",
            4, EventState.APPROVED, "Finance", ["FinTech", "Blockchain", "Cybersecurity"], 7, 10, 4,
        ),
        (
            "Green Energy Conference",
            "Sustainability, smart grids, and renewable energy technologies.",
            5, EventState.PAYMENT_DONE, "Green Energy", ["GreenTech", "IoT", "Sustainability"], 5, 14, 3,
        ),
        (
            "Cybersecurity Defense Summit",
            "Zero trust, threat intelligence, and SOC modernization.",
            6, EventState.WAITING_FOR_PAYMENT, "Cybersecurity", ["Cybersecurity", "Cloud", "AI"], 6, 20, 3,
        ),
        (
            "Digital Marketing Masterclass",
            "SEO, content strategy, and marketing automation tools exhibition.",
            7, EventState.PENDING_APPROVAL, "Marketing", ["Marketing", "Analytics", "SaaS"], 4, 28, 2,
        ),
        (
            "AI & Data Science Conference",
            "Deep learning, NLP, computer vision, and MLOps — the data revolution.",
            8, EventState.LIVE, "AI & Data", ["AI", "ML", "Big Data", "Analytics"], 10, -3, 6,
        ),
        (
            "Startup Innovation Hackathon",
            "48-hour hackathon with pitches, demos, and investor networking.",
            9, EventState.APPROVED, "Technology", ["Innovation", "Startups", "No-Code"], 5, 5, 2,
        ),
        (
            "Enterprise Cloud Summit",
            "Multi-cloud strategies, containerization, and serverless architectures.",
            1, EventState.LIVE, "Engineering", ["Cloud", "DevOps", "Kubernetes"], 8, -1, 4,
        ),
    ]

    events = []
    for title, desc, org_idx, state, cat, tags, num_ent, start_off, dur in event_definitions:
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
        )
        events.append(ev)
        print(f"  + Event: {title} [{state.value}]")

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
    # Summary
    # ──────────────────────────────────────────────────────────
    approved_count = len([e for e in events if e.get("state") == EventState.APPROVED])
    other_count = len(events) - len(live_events) - approved_count

    print("\n" + "=" * 60)
    print("  Seeding complete!")
    print("=" * 60)
    print(f"""
  Users:          1 admin + {len(organizers)} organizers + {len(enterprises)} enterprises + {len(visitors)} visitors
  Organizations:  {len(organizations)}
  Events:         {len(events)} (LIVE: {len(live_events)}, APPROVED: {approved_count}, other: {other_count})
  Stands:         {len(all_stands)}
  Resources:      {resource_count}
  Participations: {participation_count}
  Favorites:      {fav_count}
  Notifications:  {notif_count}
  Meetings:       {meeting_count}
  Chat rooms:     {chat_count}
  Lead interact.: {lead_count}
  Analytics:      {analytics_count}

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
