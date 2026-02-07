from motor.motor_asyncio import AsyncIOMotorClient
from ..core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_client = MongoDB()

async def connect_to_mongo():
    db_client.client = AsyncIOMotorClient(settings.MONGO_URI)
    db_client.db = db_client.client[settings.DATABASE_NAME]
    print(f"Connected to MongoDB: {settings.MONGO_URI}")

async def close_mongo_connection():
    if db_client.client:
        db_client.client.close()
        print("MongoDB connection closed")

def get_database():
    return db_client.db
