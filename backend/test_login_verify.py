import asyncio
from app.db.mongo import connect_to_mongo, get_database
from app.core.security import verify_password

async def test_admin_login():
    await connect_to_mongo()
    db = get_database()
    admin = await db.users.find_one({"email": "admin@demo.com"})
    if admin:
        hashed = admin.get('hashed_password')
        password = "password123" # Standard password from seed/reset scripts
        matches = verify_password(password, hashed)
        print(f"Password 'password123' matches: {matches}")
        
        # Try some variations just in case
        print(f"Password 'password' matches: {verify_password('password', hashed)}")
    else:
        print("Admin not found")

if __name__ == "__main__":
    asyncio.run(test_admin_login())
