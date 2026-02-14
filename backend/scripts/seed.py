import asyncio
import uuid
from datetime import datetime, timezone
from app.core.security import hash_password
from app.modules.auth.enums import Role
from app.modules.events.schemas import EventState
from app.db.mongo import connect_to_mongo, get_database, close_mongo_connection

async def seed_db():
    print("Connecting to MongoDB...")
    await connect_to_mongo()
    db = get_database()
    
    # Seed Users
    print("Seeding users...")
    users_collection = db["users"]
    await users_collection.delete_many({}) # Clear existing for clean seed
    
    users = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "admin@ivep.com",
            "username": "admin",
            "full_name": "Admin User",
            "hashed_password": hash_password("admin123"),
            "role": Role.ADMIN,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        },
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "email": "organizer@ivep.com",
            "username": "organizer",
            "full_name": "Organizer User",
            "hashed_password": hash_password("organizer123"),
            "role": Role.ORGANIZER,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        }
    ]
    await users_collection.insert_many(users)
    print(f"Seeded {len(users)} users.")
    
    # Seed Events
    print("Seeding events...")
    events_collection = db["events"]
    await events_collection.delete_many({})
    
    events = [
        {
            "id": "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
            "title": "Global Tech Expo 2026",
            "description": "The largest virtual gathering of tech enthusiasts and innovators.",
            "organizer_id": "22222222-2222-2222-2222-222222222222",
            "state": EventState.LIVE,
            "banner_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop",
            "category": "Technology",
            "start_date": datetime(2026, 5, 15, 9, 0, tzinfo=timezone.utc),
            "end_date": datetime(2026, 5, 17, 18, 0, tzinfo=timezone.utc),
            "location": "Virtual Hall A",
            "tags": ["AI", "Innovation", "Networking"],
            "organizer_name": "TechCore Events",
            "created_at": datetime.now(timezone.utc),
        },
        {
            "id": "e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2",
            "title": "Art & Design Showcase",
            "description": "A magnificent exhibition of contemporary art and digital design.",
            "organizer_id": "22222222-2222-2222-2222-222222222222",
            "state": EventState.APPROVED,
            "banner_url": "https://images.unsplash.com/photo-1545987796-200f13b4d453?q=80&w=2070&auto=format&fit=crop",
            "category": "Art",
            "start_date": datetime(2026, 6, 10, 10, 0, tzinfo=timezone.utc),
            "end_date": datetime(2026, 6, 12, 20, 0, tzinfo=timezone.utc),
            "location": "Creative Hub",
            "tags": ["Design", "Digital Art", "Creative"],
            "organizer_name": "Visionary Collective",
            "created_at": datetime.now(timezone.utc),
        }
    ]
    await events_collection.insert_many(events)
    print(f"Seeded {len(events)} events.")
    
    await close_mongo_connection()
    print("Seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed_db())
