import asyncio
from app.db.mongo import connect_to_mongo, get_database
from app.core.security import get_password_hash

async def main():
    await connect_to_mongo()
    db = get_database()
    hashed = get_password_hash("password123")
    
    # Reset both admin and organizer
    await db.users.update_one(
        {"email": "admin@demo.com"},
        {"$set": {"hashed_password": hashed}}
    )
    print("Reset admin@demo.com password to password123")
    
    await db.users.update_one(
        {"email": "organizer@demo.com"},
        {"$set": {"hashed_password": hashed}}
    )
    print("Reset organizer@demo.com password to password123")

if __name__ == "__main__":
    asyncio.run(main())
