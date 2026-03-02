import asyncio
from app.db.mongo import connect_to_mongo, get_database

async def main():
    await connect_to_mongo()
    db = get_database()
    admin = await db.users.find_one({"role": "admin"})
    if admin:
        print(f"Admin Email: {admin['email']}")
        print(f"Admin Hash: {admin.get('hashed_password')}")
    else:
        print("No admin user found")
    
    organizer = await db.users.find_one({"role": "organizer"})
    if organizer:
        print(f"Organizer Email: {organizer['email']}")
        print(f"Organizer Hash: {organizer.get('hashed_password')}")
    else:
        print("No organizer user found")

if __name__ == "__main__":
    asyncio.run(main())
