#!/usr/bin/env python3
"""Seed manager demo data after a reset.

Creates:
- 1 organizer account
- 3 enterprise accounts
- 5 visitor accounts
- 1 long event (starts today at 17:40 in Africa/Casablanca)
- Conference schedule slots (assigned + unassigned)
- 3 stands, products, and resources

No meetings or chat data are created.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from bson import ObjectId
from dotenv import load_dotenv
from passlib.context import CryptContext
from pymongo import MongoClient
from pymongo.collection import Collection

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


@dataclass
class SeedContext:
    db: Any
    now_utc: datetime
    event_tz: ZoneInfo


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed manager-ready demo data")
    parser.add_argument("--mongo-uri", default=None, help="Mongo URI (defaults from backend/.env)")
    parser.add_argument("--database", default=None, help="Database name (defaults from backend/.env)")
    parser.add_argument("--password", default="DemoPass#2026", help="Default password for all created demo users")
    parser.add_argument("--event-timezone", default="Africa/Casablanca", help="Event timezone")
    parser.add_argument("--execute", action="store_true", help="Actually write data")
    parser.add_argument("--yes-i-understand", action="store_true", help="Required with --execute")
    return parser.parse_args()


def load_env_defaults() -> tuple[str, str]:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    env_path = os.path.join(backend_dir, ".env")
    load_dotenv(env_path)
    return (
        os.getenv("MONGO_URI", "mongodb://localhost:27017"),
        os.getenv("DATABASE_NAME", "ivep_db"),
    )


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def to_utc(local_dt: datetime, tz: ZoneInfo) -> datetime:
    if local_dt.tzinfo is None:
        local_dt = local_dt.replace(tzinfo=tz)
    return local_dt.astimezone(timezone.utc)


def format_date_label(local_dt: datetime) -> str:
    return local_dt.strftime("Day %d - %a %b %d")


def users_col(db) -> Collection:
    return db["users"]


def orgs_col(db) -> Collection:
    return db["organizations"]


def org_members_col(db) -> Collection:
    return db["organization_members"]


def events_col(db) -> Collection:
    return db["events"]


def participants_col(db) -> Collection:
    return db["participants"]


def stands_col(db) -> Collection:
    return db["stands"]


def resources_col(db) -> Collection:
    return db["resources"]


def stand_products_col(db) -> Collection:
    return db["stand_products"]


def conferences_col(db) -> Collection:
    return db["conferences"]


def upsert_user(col: Collection, email: str, payload: dict[str, Any]) -> dict[str, Any]:
    existing = col.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if existing:
        col.update_one({"_id": existing["_id"]}, {"$set": payload})
        updated = col.find_one({"_id": existing["_id"]})
        return updated

    insert_doc = {"email": email, **payload}
    result = col.insert_one(insert_doc)
    return col.find_one({"_id": result.inserted_id})


def ensure_org_and_owner_membership(db, name: str, owner_user_id: str, description: str, extra: dict[str, Any]) -> dict[str, Any]:
    col = orgs_col(db)
    existing = col.find_one({"name": name})
    base = {
        "name": name,
        "description": description,
        "owner_id": owner_user_id,
        "created_at": datetime.now(timezone.utc),
        **extra,
    }
    if existing:
        col.update_one({"_id": existing["_id"]}, {"$set": base})
        org_doc = col.find_one({"_id": existing["_id"]})
    else:
        org_id = col.insert_one(base).inserted_id
        org_doc = col.find_one({"_id": org_id})

    mem_col = org_members_col(db)
    member = mem_col.find_one({
        "organization_id": str(org_doc["_id"]),
        "user_id": owner_user_id,
    })
    if not member:
        mem_col.insert_one({
            "organization_id": str(org_doc["_id"]),
            "user_id": owner_user_id,
            "role_in_org": "owner",
            "joined_at": datetime.now(timezone.utc),
        })

    return org_doc


def build_schedule_template(event_start_local: datetime) -> list[dict[str, Any]]:
    # 10-day schedule with conference + non-conference slots.
    schedule = [
        {
            "day_number": 1,
            "date_label": format_date_label(event_start_local),
            "slots": [
                {
                    "start_time": "17:40",
                    "end_time": "18:40",
                    "label": "Opening Keynote: Morocco Digital Vision 2030",
                    "is_conference": True,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": "",
                    "conference_id": None,
                },
                {
                    "start_time": "18:50",
                    "end_time": "19:30",
                    "label": "Expo Walkthrough and Stands Discovery",
                    "is_conference": False,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": None,
                    "conference_id": None,
                },
                {
                    "start_time": "19:40",
                    "end_time": "23:30",
                    "label": "Panel: AI Adoption in Moroccan Enterprises",
                    "is_conference": True,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": None,
                    "conference_id": None,
                },
            ],
        },
        {
            "day_number": 2,
            "date_label": format_date_label(event_start_local + timedelta(days=1)),
            "slots": [
                {
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "label": "Conference: Smart Retail with AI",
                    "is_conference": True,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": "",
                    "conference_id": None,
                },
                {
                    "start_time": "11:30",
                    "end_time": "12:15",
                    "label": "Live Product Demonstrations",
                    "is_conference": False,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": None,
                    "conference_id": None,
                },
                {
                    "start_time": "15:00",
                    "end_time": "16:00",
                    "label": "Conference: Future Skills and EdTech",
                    "is_conference": True,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": "",
                    "conference_id": None,
                },
            ],
        },
        {
            "day_number": 3,
            "date_label": format_date_label(event_start_local + timedelta(days=2)),
            "slots": [
                {
                    "start_time": "10:30",
                    "end_time": "11:15",
                    "label": "Networking Sprint: Visitors x Enterprises",
                    "is_conference": False,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": None,
                    "conference_id": None,
                },
                {
                    "start_time": "14:00",
                    "end_time": "15:00",
                    "label": "Conference Slot (Unassigned Demo)",
                    "is_conference": True,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": None,
                    "conference_id": None,
                },
            ],
        },
        {
            "day_number": 4,
            "date_label": format_date_label(event_start_local + timedelta(days=3)),
            "slots": [
                {
                    "start_time": "09:30",
                    "end_time": "10:30",
                    "label": "Growth Strategy Workshop",
                    "is_conference": False,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": None,
                    "conference_id": None,
                },
                {
                    "start_time": "16:00",
                    "end_time": "17:00",
                    "label": "Conference: Industry Success Stories",
                    "is_conference": True,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": "",
                    "conference_id": None,
                },
            ],
        },
        {
            "day_number": 5,
            "date_label": format_date_label(event_start_local + timedelta(days=4)),
            "slots": [
                {
                    "start_time": "11:00",
                    "end_time": "12:00",
                    "label": "Closing Keynote and Roadmap",
                    "is_conference": True,
                    "assigned_enterprise_id": None,
                    "assigned_enterprise_name": None,
                    "speaker_name": "",
                    "conference_id": None,
                }
            ],
        },
    ]

    # Extend to day 10 with realistic rotating sessions.
    for day_number in range(6, 11):
        day_local = event_start_local + timedelta(days=day_number - 1)
        schedule.append(
            {
                "day_number": day_number,
                "date_label": format_date_label(day_local),
                "slots": [
                    {
                        "start_time": "10:00",
                        "end_time": "11:00",
                        "label": f"Conference: Innovation Insights Day {day_number}",
                        "is_conference": True,
                        "assigned_enterprise_id": None,
                        "assigned_enterprise_name": None,
                        "speaker_name": "",
                        "conference_id": None,
                    },
                    {
                        "start_time": "12:00",
                        "end_time": "12:45",
                        "label": "Stand Demos and Marketplace Highlights",
                        "is_conference": False,
                        "assigned_enterprise_id": None,
                        "assigned_enterprise_name": None,
                        "speaker_name": None,
                        "conference_id": None,
                    },
                    {
                        "start_time": "16:30",
                        "end_time": "17:30",
                        "label": f"Conference: Use Cases and Q&A Day {day_number}",
                        "is_conference": True,
                        "assigned_enterprise_id": None,
                        "assigned_enterprise_name": None,
                        "speaker_name": "",
                        "conference_id": None,
                    },
                ],
            }
        )

    return schedule


def slot_to_utc(event_start_local: datetime, day_number: int, hhmm: str, tz: ZoneInfo) -> datetime:
    hour, minute = [int(x) for x in hhmm.split(":", 1)]
    local_day = (event_start_local + timedelta(days=day_number - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return to_utc(local_day.replace(hour=hour, minute=minute), tz)


def main() -> int:
    args = parse_args()
    if args.execute and not args.yes_i_understand:
        print("ERROR: --execute requires --yes-i-understand")
        return 2

    env_uri, env_db = load_env_defaults()
    mongo_uri = args.mongo_uri or env_uri
    database_name = args.database or env_db

    event_tz = ZoneInfo(args.event_timezone)
    now_utc = datetime.now(timezone.utc)

    today_local = now_utc.astimezone(event_tz)
    event_start_local = today_local.replace(hour=17, minute=40, second=0, microsecond=0)
    # If current local time already passed 17:40, keep today as requested and let state be live.
    # Ten-day event window (day 1 through day 10).
    event_end_local = event_start_local + timedelta(days=9, hours=4, minutes=20)

    if not args.execute:
        print("Dry-run only. No data written.")
        print(f"Database: {database_name}")
        print(f"Event local start: {event_start_local.isoformat()} ({args.event_timezone})")
        print("Will create: 1 organizer, 3 enterprises, 5 visitors, 1 event, 3 stands, products/resources, conference slots.")
        print("Run with --execute --yes-i-understand to apply.")
        return 0

    client = MongoClient(mongo_uri)
    db = client[database_name]

    try:
        # Keep admin untouched, add demo users.
        user_password_hash = hash_password(args.password)
        created_at = datetime.now(timezone.utc)

        organizer = upsert_user(
            users_col(db),
            "organizer.demo@ivep.com",
            {
                "username": "organizer_demo",
                "full_name": "Youssef El Mansouri",
                "hashed_password": user_password_hash,
                "role": "organizer",
                "is_active": True,
                "approval_status": "APPROVED",
                "created_at": created_at,
                "org_name": "Atlas Events Morocco",
                "org_type": "Event Agency",
                "org_country": "Morocco",
                "org_city": "Casablanca",
                "org_phone": "+212600100200",
                "org_website": "https://atlas-events.ma",
                "org_professional_email": "contact@atlas-events.ma",
                "language": "French",
                "timezone": "Africa/Casablanca",
            },
        )

        enterprise_specs = [
            {
                "email": "enterprise.alpha@ivep.com",
                "username": "enterprise_alpha",
                "full_name": "Nadia Benhaddou",
                "company_name": "NovaTech Systems",
                "industry": "Artificial Intelligence",
                "description": "Enterprise AI platforms for retail, logistics, and customer support automation.",
                "country": "Morocco",
                "city": "Rabat",
                "website": "https://novatech.ma",
                "linkedin": "https://linkedin.com/company/novatech-systems",
                "org": {
                    "name": "NovaTech Systems",
                    "description": "AI transformation partner for enterprise operations.",
                    "industry": "Artificial Intelligence",
                    "website": "https://novatech.ma",
                    "logo_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
                    "contact_email": "hello@novatech.ma",
                    "contact_phone": "+212651110001",
                    "city": "Rabat",
                    "country": "Morocco",
                },
                "theme_color": "#1d4ed8",
            },
            {
                "email": "enterprise.beta@ivep.com",
                "username": "enterprise_beta",
                "full_name": "Karim Ait Lahcen",
                "company_name": "GreenPulse Energy",
                "industry": "CleanTech",
                "description": "Smart energy optimization and sustainability analytics for industrial sites.",
                "country": "Morocco",
                "city": "Marrakesh",
                "website": "https://greenpulse.energy",
                "linkedin": "https://linkedin.com/company/greenpulse-energy",
                "org": {
                    "name": "GreenPulse Energy",
                    "description": "Clean energy innovation for modern enterprises.",
                    "industry": "Sustainability",
                    "website": "https://greenpulse.energy",
                    "logo_url": "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80",
                    "contact_email": "contact@greenpulse.energy",
                    "contact_phone": "+212651110002",
                    "city": "Marrakesh",
                    "country": "Morocco",
                },
                "theme_color": "#059669",
            },
            {
                "email": "enterprise.gamma@ivep.com",
                "username": "enterprise_gamma",
                "full_name": "Salma El Idrissi",
                "company_name": "EduSphere Labs",
                "industry": "EdTech",
                "description": "Digital learning products and analytics for universities and training centers.",
                "country": "Morocco",
                "city": "Tangier",
                "website": "https://edusphere.io",
                "linkedin": "https://linkedin.com/company/edusphere-labs",
                "org": {
                    "name": "EduSphere Labs",
                    "description": "Next-generation education technology for institutions.",
                    "industry": "EdTech",
                    "website": "https://edusphere.io",
                    "logo_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80",
                    "contact_email": "partners@edusphere.io",
                    "contact_phone": "+212651110003",
                    "city": "Tangier",
                    "country": "Morocco",
                },
                "theme_color": "#7c3aed",
            },
        ]

        enterprise_users: list[dict[str, Any]] = []
        organizations: list[dict[str, Any]] = []

        for spec in enterprise_specs:
            user = upsert_user(
                users_col(db),
                spec["email"],
                {
                    "username": spec["username"],
                    "full_name": spec["full_name"],
                    "hashed_password": user_password_hash,
                    "role": "enterprise",
                    "is_active": True,
                    "approval_status": "APPROVED",
                    "created_at": created_at,
                    "company_name": spec["company_name"],
                    "professional_email": spec["email"],
                    "industry": spec["industry"],
                    "description": spec["description"],
                    "country": spec["country"],
                    "city": spec["city"],
                    "creation_year": 2018,
                    "company_size": "51-200",
                    "website": spec["website"],
                    "linkedin": spec["linkedin"],
                    "org_name": spec["org"]["name"],
                    "org_type": "Enterprise",
                    "org_country": spec["org"]["country"],
                    "org_city": spec["org"]["city"],
                    "org_website": spec["org"]["website"],
                    "org_professional_email": spec["org"]["contact_email"],
                    "timezone": "Africa/Casablanca",
                    "language": "French",
                },
            )
            enterprise_users.append(user)
            org = ensure_org_and_owner_membership(
                db,
                spec["org"]["name"],
                str(user["_id"]),
                spec["org"]["description"],
                {
                    "industry": spec["org"]["industry"],
                    "website": spec["org"]["website"],
                    "logo_url": spec["org"]["logo_url"],
                    "contact_email": spec["org"]["contact_email"],
                    "contact_phone": spec["org"]["contact_phone"],
                    "city": spec["org"]["city"],
                    "country": spec["org"]["country"],
                    "type": "enterprise",
                    "is_verified": True,
                    "is_flagged": False,
                    "is_suspended": False,
                },
            )
            organizations.append(org)

        visitor_specs = [
            ("visitor.one@ivep.com", "visitor_one", "Amine Zahraoui", "Product Designer", "Design", "Casablanca"),
            ("visitor.two@ivep.com", "visitor_two", "Khadija Tazi", "Data Analyst", "Data", "Rabat"),
            ("visitor.three@ivep.com", "visitor_three", "Mehdi Boulahya", "Startup Founder", "Entrepreneurship", "Marrakesh"),
            ("visitor.four@ivep.com", "visitor_four", "Sara Mernissi", "Innovation Manager", "Innovation", "Fes"),
            ("visitor.five@ivep.com", "visitor_five", "Omar El Kettani", "Software Engineer", "AI", "Tangier"),
        ]

        visitor_users: list[dict[str, Any]] = []
        for email, username, full_name, job_title, interest, city in visitor_specs:
            visitor = upsert_user(
                users_col(db),
                email,
                {
                    "username": username,
                    "full_name": full_name,
                    "hashed_password": user_password_hash,
                    "role": "visitor",
                    "is_active": True,
                    "approval_status": None,
                    "created_at": created_at,
                    "bio": f"{job_title} interested in digital transformation and high-impact collaborations.",
                    "language": "French",
                    "timezone": "Africa/Casablanca",
                    "professional_info": {
                        "job_title": job_title,
                        "industry": "Technology",
                        "company": "Independent Professional",
                        "experience_level": "Senior",
                    },
                    "interests": [interest, "Networking", "Digital Events"],
                    "event_preferences": {
                        "types": ["Exhibition", "Networking", "Webinar"],
                        "languages": ["French", "Arabic", "English"],
                        "regions": ["Morocco", "MENA", "Europe"],
                    },
                    "networking_goals": ["Find partners", "Discover products", "Attend conferences"],
                    "engagement_settings": {
                        "recommendations_enabled": True,
                        "email_notifications": True,
                    },
                    "org_city": city,
                    "org_country": "Morocco",
                },
            )
            visitor_users.append(visitor)

        organizer_org = ensure_org_and_owner_membership(
            db,
            "Atlas Events Morocco",
            str(organizer["_id"]),
            "Organizer of premium innovation and technology exhibitions in MENA.",
            {
                "industry": "Events",
                "website": "https://atlas-events.ma",
                "logo_url": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
                "contact_email": "contact@atlas-events.ma",
                "contact_phone": "+212651119999",
                "city": "Casablanca",
                "country": "Morocco",
                "type": "organizer",
                "is_verified": True,
                "is_flagged": False,
                "is_suspended": False,
            },
        )

        schedule_days = build_schedule_template(event_start_local)
        event_doc = {
            "title": "Morocco AI & Innovation Grand Expo 2026",
            "description": "A large-scale virtual exhibition connecting enterprises, visitors, and organizers across Morocco and MENA for technology, sustainability, and education innovation.",
            "organizer_id": str(organizer["_id"]),
            "state": "live",
            "banner_url": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1920&q=80",
            "category": "Technology",
            "start_date": to_utc(event_start_local, event_tz),
            "end_date": to_utc(event_end_local, event_tz),
            "event_timezone": args.event_timezone,
            "location": "Virtual Platform",
            "tags": ["AI", "Innovation", "Morocco", "Enterprise", "EdTech", "CleanTech"],
            "organizer_name": "Atlas Events Morocco",
            "created_at": datetime.now(timezone.utc),
            "num_enterprises": 3,
            "event_timeline": json.dumps(schedule_days),
            "schedule_days": schedule_days,
            "extended_details": "This flagship event is built for full platform testing: stands, resources, marketplace products, networking, conference scheduling, and participant journeys.",
            "additional_info": "Visitors join for free. Enterprises can showcase products, resources, and conference sessions.",
            "stand_price": 2500.0,
            "is_paid": False,
            "ticket_price": None,
            "payment_amount": 0.0,
            "rib_code": None,
            "payment_proof_url": None,
            "enterprise_invite_token": secrets.token_urlsafe(24),
            "visitor_invite_token": secrets.token_urlsafe(24),
            "rejection_reason": None,
        }

        existing_event = events_col(db).find_one({"title": event_doc["title"]})
        if existing_event:
            events_col(db).update_one({"_id": existing_event["_id"]}, {"$set": event_doc})
            event = events_col(db).find_one({"_id": existing_event["_id"]})
        else:
            event_id = events_col(db).insert_one(event_doc).inserted_id
            event = events_col(db).find_one({"_id": event_id})

        event_id_str = str(event["_id"])

        # Add access links after _id is known.
        events_col(db).update_one(
            {"_id": event["_id"]},
            {
                "$set": {
                    "enterprise_link": f"/join/enterprise/{event_id_str}?token={event_doc['enterprise_invite_token']}",
                    "visitor_link": f"/join/visitor/{event_id_str}?token={event_doc['visitor_invite_token']}",
                    "publicity_link": f"/events/{event_id_str}",
                }
            },
        )

        # Approved participants for all demo users.
        participant_entries = [
            {"user": organizer, "role": "organizer", "status": "approved", "organization_id": str(organizer_org["_id"])},
        ]
        for enterprise_user, org in zip(enterprise_users, organizations):
            participant_entries.append(
                {
                    "user": enterprise_user,
                    "role": "enterprise",
                    "status": "approved",
                    "organization_id": str(org["_id"]),
                }
            )
        for visitor in visitor_users:
            participant_entries.append(
                {
                    "user": visitor,
                    "role": "visitor",
                    "status": "approved",
                    "organization_id": None,
                }
            )

        for entry in participant_entries:
            uid = str(entry["user"]["_id"])
            query = {"event_id": event_id_str, "user_id": uid}
            payload = {
                "event_id": event_id_str,
                "user_id": uid,
                "role": entry["role"],
                "status": entry["status"],
                "created_at": datetime.now(timezone.utc),
                "organization_id": entry["organization_id"],
            }
            existing = participants_col(db).find_one(query)
            if existing:
                participants_col(db).update_one({"_id": existing["_id"]}, {"$set": payload})
            else:
                participants_col(db).insert_one(payload)

        # Create stands for enterprise organizations.
        stand_docs: list[dict[str, Any]] = []
        for spec, org in zip(enterprise_specs, organizations):
            stand_query = {
                "event_id": event_id_str,
                "organization_id": str(org["_id"]),
            }
            stand_payload = {
                "event_id": event_id_str,
                "organization_id": str(org["_id"]),
                "name": spec["org"]["name"],
                "description": spec["description"],
                "logo_url": spec["org"]["logo_url"],
                "tags": [spec["industry"], "Innovation", "Demo"],
                "stand_type": "standard",
                "category": spec["industry"],
                "theme_color": spec["theme_color"],
                "stand_background_url": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80",
                "presenter_avatar_bg": "#ffffff",
                "presenter_name": spec["full_name"],
                "presenter_avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
                "created_at": datetime.now(timezone.utc),
            }
            existing = stands_col(db).find_one(stand_query)
            if existing:
                stands_col(db).update_one({"_id": existing["_id"]}, {"$set": stand_payload})
                stand = stands_col(db).find_one({"_id": existing["_id"]})
            else:
                sid = stands_col(db).insert_one(stand_payload).inserted_id
                stand = stands_col(db).find_one({"_id": sid})
            stand_docs.append(stand)

        # Products for each stand (in stand_products collection).
        for stand, spec in zip(stand_docs, enterprise_specs):
            sid = stand["_id"]
            stand_products_col(db).delete_many({"stand_id": sid})
            product_items = [
                {
                    "name": f"{spec['org']['name']} Starter Package",
                    "description": "Entry-level package for pilot projects and quick onboarding.",
                    "price": 1499.0,
                    "currency": "MAD",
                    "image_url": "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?auto=format&fit=crop&w=900&q=80",
                    "stock": 20,
                    "type": "product",
                },
                {
                    "name": f"{spec['org']['name']} Enterprise Suite",
                    "description": "Full enterprise-grade platform with analytics and automation capabilities.",
                    "price": 8999.0,
                    "currency": "MAD",
                    "image_url": "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80",
                    "stock": 8,
                    "type": "product",
                },
                {
                    "name": f"{spec['org']['name']} Advisory Session",
                    "description": "1:1 strategic advisory service tailored for your business context.",
                    "price": 1200.0,
                    "currency": "MAD",
                    "image_url": "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80",
                    "stock": 0,
                    "type": "service",
                },
            ]
            for item in product_items:
                stand_products_col(db).insert_one(
                    {
                        "stand_id": sid,
                        **item,
                        "created_at": datetime.now(timezone.utc),
                    }
                )

        # Resources for each stand.
        for stand, spec in zip(stand_docs, enterprise_specs):
            stand_id_str = str(stand["_id"])
            resources_col(db).delete_many({"stand_id": stand_id_str})
            resources = [
                {
                    "title": f"{spec['org']['name']} Corporate Brochure",
                    "description": "Company profile, offer structure, and implementation references.",
                    "stand_id": stand_id_str,
                    "type": "document",
                    "tags": ["brochure", "company", "pdf"],
                    "file_path": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                    "file_size": 524288,
                    "mime_type": "application/pdf",
                    "upload_date": datetime.now(timezone.utc),
                    "downloads": 0,
                },
                {
                    "title": f"{spec['org']['name']} Product Demo Video",
                    "description": "Recorded demo presenting core product workflows and outcomes.",
                    "stand_id": stand_id_str,
                    "type": "video",
                    "tags": ["demo", "video", "product"],
                    "file_path": "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
                    "file_size": 0,
                    "mime_type": "video/mp4",
                    "upload_date": datetime.now(timezone.utc),
                    "downloads": 0,
                },
            ]
            resources_col(db).insert_many(resources)

        # Create conference docs for assigned conference slots and patch schedule with conference_id.
        updated_schedule = events_col(db).find_one({"_id": event["_id"]}).get("schedule_days", schedule_days)

        assigned_map = [
            (1, "Opening Keynote: Morocco Digital Vision 2030", enterprise_users[0], stand_docs[0], "Nadia Benhaddou"),
            (2, "Conference: Smart Retail with AI", enterprise_users[1], stand_docs[1], "Karim Ait Lahcen"),
            (2, "Conference: Future Skills and EdTech", enterprise_users[2], stand_docs[2], "Salma El Idrissi"),
            (4, "Conference: Industry Success Stories", enterprise_users[0], stand_docs[0], "Nadia Benhaddou"),
            (5, "Closing Keynote and Roadmap", enterprise_users[1], stand_docs[1], "Karim Ait Lahcen"),
        ]

        for day_number, slot_label, enterprise_user, stand_doc, speaker_name in assigned_map:
            day = next((d for d in updated_schedule if int(d.get("day_number", 0)) == day_number), None)
            if not day:
                continue
            slot = next((s for s in (day.get("slots") or []) if s.get("label") == slot_label), None)
            if not slot:
                continue

            start_utc = slot_to_utc(event_start_local, day_number, slot["start_time"], event_tz)
            end_utc = slot_to_utc(event_start_local, day_number, slot["end_time"], event_tz)

            existing_conf = conferences_col(db).find_one({
                "event_id": event_id_str,
                "title": slot_label,
            })

            conf_payload = {
                "title": slot_label,
                "description": f"Session hosted by {enterprise_user['full_name']} during the manager demo event.",
                "speaker_name": speaker_name,
                "assigned_enterprise_id": str(enterprise_user["_id"]),
                "organizer_id": str(organizer["_id"]),
                "event_id": event_id_str,
                "stand_id": str(stand_doc["_id"]),
                "start_time": start_utc,
                "end_time": end_utc,
                "status": "scheduled",
                "room_name": None,
                "max_attendees": 300,
                "attendee_count": 0,
                "chat_enabled": True,
                "qa_enabled": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }

            if existing_conf:
                conferences_col(db).update_one({"_id": existing_conf["_id"]}, {"$set": conf_payload})
                conf_id = existing_conf["_id"]
            else:
                conf_id = conferences_col(db).insert_one(conf_payload).inserted_id

            slot["is_conference"] = True
            slot["assigned_enterprise_id"] = str(enterprise_user["_id"])
            slot["assigned_enterprise_name"] = enterprise_user["full_name"]
            slot["speaker_name"] = speaker_name
            slot["conference_id"] = str(conf_id)

        # Keep one conference slot intentionally unassigned.
        day3 = next((d for d in updated_schedule if int(d.get("day_number", 0)) == 3), None)
        if day3:
            unassigned = next((s for s in (day3.get("slots") or []) if s.get("label") == "Conference Slot (Unassigned Demo)"), None)
            if unassigned:
                unassigned["is_conference"] = True
                unassigned["assigned_enterprise_id"] = None
                unassigned["assigned_enterprise_name"] = None
                unassigned["speaker_name"] = None
                unassigned["conference_id"] = None

        events_col(db).update_one(
            {"_id": event["_id"]},
            {"$set": {"schedule_days": updated_schedule, "event_timeline": json.dumps(updated_schedule)}},
        )

        print("Demo seed completed successfully.")
        print("Created/updated accounts:")
        print("  Organizer: organizer.demo@ivep.com")
        print("  Enterprises: enterprise.alpha@ivep.com, enterprise.beta@ivep.com, enterprise.gamma@ivep.com")
        print("  Visitors: visitor.one@ivep.com ... visitor.five@ivep.com")
        print(f"Default password for all demo accounts: {args.password}")
        print(f"Event: Morocco AI & Innovation Grand Expo 2026 (ID: {event_id_str})")
        print(f"Event start (Africa/Casablanca): {event_start_local.strftime('%Y-%m-%d %H:%M')}")
        print("Event is set to live and free for visitors (is_paid=false).")
        print("No meetings or chat data were seeded.")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
