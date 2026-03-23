import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from datetime import datetime, timezone
from app.core.security import get_password_hash
from app.db.mongo import close_mongo_connection, connect_to_mongo, get_database
from app.modules.auth.enums import Role


async def create_admin_account():
    await connect_to_mongo()
    try:
        db = get_database()
        
        admin_email = "admin@ivep.com"
        admin_password = "ivep_admin123@"  # Change this to your desired password
        
        # Check if admin already exists
        existing = await db.users.find_one({"email": admin_email})
        if existing:
            print(f"✓ Admin account already exists: {admin_email}")
            return
        
        # Create admin user
        admin_user = {
            "email": admin_email,
            "full_name": "Administrator",
            "role": Role.ADMIN.value,
            "is_active": True,
            "hashed_password": get_password_hash(admin_password),
            "bio": "Platform Administrator",
            "title": "Admin",
            "company": "IVEP",
            "phone": "",
            "city": "",
            "country": "",
            "interests": [],
            "networking_goals": [],
            "avatar_url": None,
            "professional_info": {
                "job_title": "Admin",
                "company": "IVEP",
                "industry": None,
            },
            "created_at": datetime.now(timezone.utc),
        }
        
        result = await db.users.insert_one(admin_user)
        print(f"✓ Admin account created successfully")
        print(f"  Email: {admin_email}")
        print(f"  Password: {admin_password}")
        print(f"  ID: {result.inserted_id}")
        
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(create_admin_account())
