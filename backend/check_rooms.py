import asyncio
import os
import sys
from bson import ObjectId

# Add current directory to path
sys.path.append(os.getcwd())

from app.db.mongo import connect_to_mongo, get_database, close_mongo_connection

async def check():
    await connect_to_mongo()
    db = get_database()
    rooms = await db.chat_rooms.find().to_list(100)
    print(f"Found {len(rooms)} rooms")
    for r in rooms:
        print(f"Room: {r.get('_id')} | Event: {r.get('event_id')} | Stand: {r.get('stand_id')} | Category: {r.get('room_category')} | Members: {r.get('members')}")
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(check())
