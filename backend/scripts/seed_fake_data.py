import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4
from bson import ObjectId
from pymongo import MongoClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from app.core.config import get_settings
from app.core.security import hash_password


def main():
    settings = get_settings()
    client = MongoClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]

    USERS_ADMIN_ID = "11111111-1111-1111-1111-111111111111"
    USERS_ORG_ID = "22222222-2222-2222-2222-222222222222"
    USERS_VISITOR_ID = "33333333-3333-3333-3333-333333333333"

    users = [
        {
            "_id": USERS_ADMIN_ID,
            "email": "admin@ivep.com",
            "full_name": "Admin User",
            "hashed_password": hash_password("admin123"),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.utcnow(),
        },
        {
            "_id": USERS_ORG_ID,
            "email": "organizer@ivep.com",
            "full_name": "Organizer User",
            "hashed_password": hash_password("organizer123"),
            "role": "organizer",
            "is_active": True,
            "created_at": datetime.utcnow(),
        },
        {
            "_id": USERS_VISITOR_ID,
            "email": "visitor@ivep.com",
            "full_name": "Visitor User",
            "hashed_password": hash_password("visitor123"),
            "role": "visitor",
            "is_active": True,
            "created_at": datetime.utcnow(),
        },
    ]
    db.users.delete_many({})
    db.users.insert_many(users)

    stand_id = "test-stand-123"
    visitor_id = "visitor-456"
    enterprise_id = "enterprise-123"

    org = {
        "_id": "org-acme-1",
        "name": "Acme Corp",
        "description": "Exhibitor",
        "owner_id": USERS_ORG_ID,
        "created_at": datetime.utcnow(),
    }
    db.organizations.delete_many({})
    db.organizations.insert_one(org)

    db.org_members.delete_many({})
    db.org_members.insert_many([
        {"user_id": users[1]["_id"], "organization_id": org["_id"], "role_in_org": "owner", "joined_at": datetime.utcnow()}
    ])

    db.subscriptions.delete_many({})
    db.subscriptions.insert_one({"organization_id": org["_id"], "plan": "pro"})

    event = {
        "_id": "event-spring-1",
        "title": "Spring Expo",
        "description": "Annual showcase",
        "organizer_id": USERS_ORG_ID,
        "state": "live",
        "created_at": datetime.utcnow(),
    }
    db.events.delete_many({})
    db.events.insert_one(event)

    stand_doc = {
        "_id": stand_id,
        "event_id": event["_id"],
        "organization_id": org["_id"],
        "name": "Acme Booth",
        "created_at": datetime.utcnow(),
    }
    db.stands.delete_many({})
    db.stands.insert_one(stand_doc)

    db.participants.delete_many({})
    db.participants.insert_many([
        {"event_id": event["_id"], "user_id": USERS_VISITOR_ID, "status": "approved"},
        {"event_id": event["_id"], "organization_id": org["_id"], "status": "approved"},
    ])

    resources = [
        {
            "title": "Company Brochure",
            "description": "Overview of services",
            "stand_id": stand_id,
            "type": "pdf",
            "tags": ["brochure", "company"],
            "file_path": "uploads/resources/test-stand-123_brochure.pdf",
            "file_size": 102400,
            "mime_type": "application/pdf",
            "upload_date": datetime.utcnow(),
            "downloads": 0,
        },
        {
            "title": "Product Video",
            "description": "Demo video",
            "stand_id": stand_id,
            "type": "video",
            "tags": ["demo", "product"],
            "file_path": "uploads/resources/test-stand-123_demo.mp4",
            "file_size": 10485760,
            "mime_type": "video/mp4",
            "upload_date": datetime.utcnow(),
            "downloads": 0,
        },
    ]
    db.resources.insert_many(resources)

    meetings = [
        {
            "visitor_id": visitor_id,
            "stand_id": stand_id,
            "start_time": datetime.utcnow() + timedelta(days=1, hours=1),
            "end_time": datetime.utcnow() + timedelta(days=1, hours=1, minutes=30),
            "purpose": "Product demonstration",
            "status": "pending",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    ]
    db.meetings.insert_many(meetings)

    lead_docs = [
        {
            "visitor_id": visitor_id,
            "stand_id": stand_id,
            "interactions_count": 3,
            "score": 30,
            "last_interaction": datetime.utcnow(),
            "visitor_name": "Visitor 0456",
            "email": "user_0456@example.com",
            "tags": ["hot"],
        }
    ]
    db.leads.insert_many(lead_docs)

    room = {
        "type": "direct",
        "members": [visitor_id, enterprise_id],
        "created_at": ObjectId().generation_time,
    }
    room_id = db.chat_rooms.insert_one(room).inserted_id

    messages = [
        {
            "room_id": str(room_id),
            "sender_id": visitor_id,
            "content": "Hello, I am interested in your product.",
            "type": "text",
            "timestamp": datetime.utcnow(),
        },
        {
            "room_id": str(room_id),
            "sender_id": enterprise_id,
            "content": "Thanks for reaching out. Let's schedule a demo.",
            "type": "text",
            "timestamp": datetime.utcnow(),
        },
    ]
    db.chat_messages.insert_many(messages)

    print("Seed completed")
    print(f"users: {db.users.count_documents({})}")
    print(f"organizations: {db.organizations.count_documents({})}")
    print(f"events: {db.events.count_documents({})}")
    print(f"stands: {db.stands.count_documents({})}")
    print(f"resources: {db.resources.count_documents({})}")
    print(f"meetings: {db.meetings.count_documents({})}")
    print(f"leads: {db.leads.count_documents({})}")
    print(f"chat_rooms: {db.chat_rooms.count_documents({})}")
    print(f"chat_messages: {db.chat_messages.count_documents({})}")


if __name__ == "__main__":
    main()
