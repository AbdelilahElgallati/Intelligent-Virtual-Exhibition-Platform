import sys
import os
from pymongo import MongoClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from app.core.config import get_settings


def create_collection(db, name, validator=None):
    if name in db.list_collection_names():
        if validator:
            db.command("collMod", name, validator=validator, validationLevel="moderate")
        return
    db.create_collection(name, validator=validator) if validator else db.create_collection(name)


def main():
    settings = get_settings()
    client = MongoClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]

    validators = {
        "users": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["email", "full_name", "hashed_password", "role", "is_active", "created_at"],
                "properties": {
                    "email": {"bsonType": "string"},
                    "full_name": {"bsonType": "string"},
                    "hashed_password": {"bsonType": "string"},
                    "role": {"enum": ["admin", "organizer", "visitor", "enterprise"]},
                    "is_active": {"bsonType": "bool"},
                    "created_at": {"bsonType": "date"},
                },
            }
        },
        "organizations": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["name", "owner_id", "created_at"],
                "properties": {
                    "name": {"bsonType": "string"},
                    "description": {"bsonType": ["string", "null"]},
                    "owner_id": {"bsonType": "string"},
                    "created_at": {"bsonType": "date"},
                },
            }
        },
        "org_members": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["user_id", "organization_id", "role_in_org", "joined_at"],
                "properties": {
                    "user_id": {"bsonType": "string"},
                    "organization_id": {"bsonType": "string"},
                    "role_in_org": {"enum": ["owner", "manager", "member"]},
                    "joined_at": {"bsonType": "date"},
                },
            }
        },
        "subscriptions": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["organization_id", "plan"],
                "properties": {
                    "organization_id": {"bsonType": "string"},
                    "plan": {"enum": ["free", "pro"]},
                },
            }
        },
        "events": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["title", "organizer_id", "state", "created_at"],
                "properties": {
                    "title": {"bsonType": "string"},
                    "description": {"bsonType": ["string", "null"]},
                    "organizer_id": {"bsonType": "string"},
                    "state": {"enum": ["draft", "pending_approval", "approved", "live", "closed"]},
                    "created_at": {"bsonType": "date"},
                },
            }
        },
        "stands": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["event_id", "organization_id", "name", "created_at"],
                "properties": {
                    "event_id": {"bsonType": "string"},
                    "organization_id": {"bsonType": "string"},
                    "name": {"bsonType": "string"},
                    "created_at": {"bsonType": "date"},
                },
            }
        },
        "participants": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["event_id", "status"],
                "properties": {
                    "event_id": {"bsonType": "string"},
                    "user_id": {"bsonType": ["string", "null"]},
                    "organization_id": {"bsonType": ["string", "null"]},
                    "status": {"enum": ["invited", "requested", "approved", "rejected"]},
                },
            }
        },
        "resources": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["title", "stand_id", "type", "file_path", "file_size", "mime_type", "upload_date"],
                "properties": {
                    "title": {"bsonType": "string"},
                    "description": {"bsonType": ["string", "null"]},
                    "stand_id": {"bsonType": "string"},
                    "type": {"enum": ["pdf", "video", "image", "document"]},
                    "tags": {"bsonType": "array"},
                    "file_path": {"bsonType": "string"},
                    "file_size": {"bsonType": "int"},
                    "mime_type": {"bsonType": "string"},
                    "upload_date": {"bsonType": "date"},
                    "downloads": {"bsonType": "int"},
                },
            }
        },
        "meetings": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["visitor_id", "stand_id", "start_time", "end_time", "status", "created_at"],
                "properties": {
                    "visitor_id": {"bsonType": "string"},
                    "stand_id": {"bsonType": "string"},
                    "start_time": {"bsonType": "date"},
                    "end_time": {"bsonType": "date"},
                    "purpose": {"bsonType": ["string", "null"]},
                    "status": {"enum": ["pending", "approved", "rejected", "canceled", "completed"]},
                    "created_at": {"bsonType": "date"},
                    "updated_at": {"bsonType": "date"},
                },
            }
        },
        "leads": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["visitor_id", "stand_id", "interactions_count", "score", "last_interaction"],
                "properties": {
                    "visitor_id": {"bsonType": "string"},
                    "stand_id": {"bsonType": "string"},
                    "interactions_count": {"bsonType": "int"},
                    "score": {"bsonType": "int"},
                    "last_interaction": {"bsonType": "date"},
                    "visitor_name": {"bsonType": "string"},
                    "email": {"bsonType": "string"},
                    "tags": {"bsonType": "array"},
                },
            }
        },
        "lead_interactions": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["visitor_id", "stand_id", "interaction_type"],
                "properties": {
                    "visitor_id": {"bsonType": "string"},
                    "stand_id": {"bsonType": "string"},
                    "interaction_type": {"bsonType": "string"},
                    "metadata": {"bsonType": "object"},
                    "timestamp": {"bsonType": "date"},
                },
            }
        },
        "chat_rooms": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["type", "members", "created_at"],
                "properties": {
                    "type": {"enum": ["direct", "group"]},
                    "members": {"bsonType": "array"},
                    "created_at": {"bsonType": "date"},
                },
            }
        },
        "chat_messages": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["room_id", "sender_id", "content", "type", "timestamp"],
                "properties": {
                    "room_id": {"bsonType": "string"},
                    "sender_id": {"bsonType": "string"},
                    "content": {"bsonType": "string"},
                    "type": {"enum": ["text", "file", "system"]},
                    "timestamp": {"bsonType": "date"},
                },
            }
        },
        "analytics_events": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["type", "timestamp"],
                "properties": {
                    "type": {"bsonType": "string"},
                    "user_id": {"bsonType": ["string", "null"]},
                    "event_id": {"bsonType": ["string", "null"]},
                    "stand_id": {"bsonType": ["string", "null"]},
                    "timestamp": {"bsonType": "date"},
                },
            }
        },
    }

    for name, validator in validators.items():
        create_collection(db, name, validator)

    print("Initialized collections with validators:")
    for name in validators.keys():
        print(f"- {name}")


if __name__ == "__main__":
    main()
