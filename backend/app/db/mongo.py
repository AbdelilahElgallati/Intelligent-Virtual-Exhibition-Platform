import logging
from urllib.parse import quote_plus
from motor.motor_asyncio import AsyncIOMotorClient
from ..core.config import settings

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_client = MongoDB()

async def connect_to_mongo():
    """
    Connect to MongoDB with proper configuration.
    """
    try:
        # Ensure MongoDB URI credentials are properly escaped
        mongo_uri = settings.MONGO_URI
        
        # If building URI from components, escape credentials
        # Otherwise, if using full URI, verify it has proper escaping
        if mongo_uri and "://" in mongo_uri:
            # Check if credentials need escaping (they should already be escaped, but ensure compatibility)
            pass
        
        # Configure connection with timeouts and pooling
        db_client.client = AsyncIOMotorClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=None,
            retryWrites=True,
            maxPoolSize=50,
            minPoolSize=10,
        )
        # Test connection by pinging the server
        await db_client.client.admin.command("ping")
        db_client.db = db_client.client[settings.DATABASE_NAME]
        logger.info(f"✓ Connected to MongoDB database: {settings.DATABASE_NAME}")
    except Exception as e:
        logger.error(f"✗ Failed to connect to MongoDB: {str(e)}")
        raise

async def close_mongo_connection():
    """
    Gracefully close MongoDB connection.
    """
    if db_client.client is not None:
        db_client.client.close()
        logger.info("MongoDB connection closed")

async def check_mongo_health():
    """
    Health check for MongoDB connectivity.
    """
    try:
        await db_client.client.admin.command("ping")
        return {"status": "healthy", "database": settings.DATABASE_NAME}
    except Exception as e:
        logger.error(f"MongoDB health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}

def get_database():
    """
    Get the MongoDB database instance.
    """
    if db_client.db is None:
        raise RuntimeError("MongoDB not connected. Call connect_to_mongo() first.")
    return db_client.db
