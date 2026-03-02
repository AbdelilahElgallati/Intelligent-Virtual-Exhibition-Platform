import asyncio
from app.db.mongo import connect_to_mongo, get_database

async def inspect():
    await connect_to_mongo()
    db = get_database()
    admin = await db.users.find_one({"email": "admin@demo.com"})
    if admin:
        hp = admin.get('hashed_password')
        print(f"Hash length: {len(hp)}")
        print(f"Hash repr: {repr(hp)}")
        has_space = ' ' in hp
        has_newline = '\n' in hp
        print(f"Contains spaces: {has_space}")
        print(f"Contains newlines: {has_newline}")
    else:
        print("Admin not found")

if __name__ == "__main__":
    asyncio.run(inspect())
