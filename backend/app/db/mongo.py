import logging
import asyncio
import os
from urllib.parse import quote_plus
from motor.motor_asyncio import AsyncIOMotorClient
from ..core.config import settings

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_client = MongoDB()

async def connect_to_mongo(max_retries: int = 3):
    """
    Connect to MongoDB with proper configuration and retry logic.
    Supports both local and cloud (MongoDB Atlas) connections.
    
    Args:
        max_retries: Number of connection attempts (default: 3)
    """
    mongo_uri = settings.MONGO_URI
    retry_count = 0
    last_error = None
    
    # Determine connection type
    is_local = "localhost" in mongo_uri or "127.0.0.1" in mongo_uri or mongo_uri.startswith("mongodb://")
    is_cloud = "mongodb+srv://" in mongo_uri
    
    connection_type = "local MongoDB" if is_local else "MongoDB Atlas (cloud)" if is_cloud else "MongoDB"
    logger.info(f"Initializing connection to {connection_type}")
    logger.debug(f"MongoDB URI: {mongo_uri[:50]}...")
    
    while retry_count < max_retries:
        try:
            logger.info(f"Connection attempt {retry_count + 1}/{max_retries}...")
            
            # Configure connection parameters based on connection type
            # Local connections use shorter timeouts, cloud connections use longer
            if is_local:
                connection_kwargs = {
                    "serverSelectionTimeoutMS": 5000,      # 5 seconds for local
                    "connectTimeoutMS": 10000,             # 10 seconds for local
                    "socketTimeoutMS": None,
                    "retryWrites": True,
                    "maxPoolSize": 50,
                    "minPoolSize": 10,
                }
            else:
                connection_kwargs = {
                    "serverSelectionTimeoutMS": 10000,     # 10 seconds for cloud
                    "connectTimeoutMS": 15000,             # 15 seconds for cloud
                    "socketTimeoutMS": None,
                    "retryWrites": True,
                    "maxPoolSize": 50,
                    "minPoolSize": 10,
                }
            
            db_client.client = AsyncIOMotorClient(mongo_uri, **connection_kwargs)
            
            # Test connection with timeout
            await asyncio.wait_for(
                db_client.client.admin.command("ping"),
                timeout=5.0
            )
            
            db_client.db = db_client.client[settings.DATABASE_NAME]
            logger.info(f"✓ Successfully connected to MongoDB database: {settings.DATABASE_NAME}")
            logger.info(f"✓ Connection type: {connection_type}")
            return
            
        except asyncio.TimeoutError as e:
            last_error = f"Connection timeout"
            logger.warning(f"⚠ Timeout connecting to {connection_type} (attempt {retry_count + 1}/{max_retries})")
            retry_count += 1
            if retry_count < max_retries:
                wait_time = 2 ** retry_count  # Exponential backoff: 2s, 4s, 8s
                logger.info(f"  Retrying in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
                
        except Exception as e:
            last_error = str(e)
            logger.warning(f"⚠ Error on attempt {retry_count + 1}/{max_retries}: {last_error}")
            retry_count += 1
            if retry_count < max_retries:
                wait_time = 2 ** retry_count
                logger.info(f"  Retrying in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
    
    # All retries exhausted - provide detailed troubleshooting
    _handle_connection_failure(is_local, is_cloud, last_error, connection_type, mongo_uri)

def _handle_connection_failure(is_local: bool, is_cloud: bool, last_error: str, connection_type: str, mongo_uri: str):
    """Provide detailed troubleshooting guidance based on connection type."""
    
    logger.error(f"\n{'='*80}")
    logger.error(f"✗ FAILED TO CONNECT TO {connection_type.upper()}")
    logger.error(f"{'='*80}")
    logger.error(f"Last error: {last_error}\n")
    
    if is_local:
        logger.error("📋 TROUBLESHOOTING - LOCAL MONGODB:")
        logger.error("-" * 80)
        logger.error("1. Verify MongoDB is running:")
        logger.error("   • Check Windows Services: Services > MongoDB > Status = Running")
        logger.error("   • Or test in PowerShell: mongosh")
        logger.error("")
        logger.error("2. Check MONGO_URI in backend/.env:")
        logger.error(f"   • Current: {mongo_uri}")
        logger.error("   • Should be: mongodb://localhost:27017")
        logger.error("   • For auth: mongodb://username:password@localhost:27017/ivep_db?authSource=admin")
        logger.error("")
        logger.error("3. If MongoDB won't start:")
        logger.error("   • Install from: https://www.mongodb.com/try/download/community")
        logger.error("   • Or via Chocolatey: choco install mongodb-community")
        logger.error("")
        logger.error("4. Start MongoDB manually:")
        logger.error("   • Open PowerShell as Administrator")
        logger.error("   • Run: Start-Service MongoDB")
        logger.error("")
        logger.error("5. See SETUP_LOCAL_MONGODB.md for complete setup instructions")
        
    elif is_cloud:
        logger.error("📋 TROUBLESHOOTING - MONGODB ATLAS (CLOUD):")
        logger.error("-" * 80)
        logger.error("")
        logger.error("⚡ QUICK FIXES (Try These First):")
        logger.error("  1. Flush DNS cache:")
        logger.error("     PowerShell: ipconfig /flushdns")
        logger.error("")
        logger.error("  2. Switch to Google DNS (8.8.8.8) - your ISP DNS might be slow")
        logger.error("     This is often the root cause of timeout errors")
        logger.error("")
        logger.error("  3. Restart your machine (clears network cache)")
        logger.error("")
        logger.error("  4. Check internet connection:")
        logger.error("     PowerShell: ping google.com")
        logger.error("")
        logger.error("📊 MONGODB ATLAS VERIFICATION:")
        logger.error("  • Cluster Status: https://cloud.mongodb.com/v2/")
        logger.error("    Should show: 'AVAILABLE' (green circle)")
        logger.error("")
        logger.error("  • IP Whitelist: Network Access > IP Whitelist")
        logger.error("    Your IP should be whitelisted (or 0.0.0.0/0 for dev)")
        logger.error("")
        logger.error("  • Credentials: Verify username & password in MONGO_URI")
        logger.error("    Special chars must be URL-encoded")
        logger.error("")
        logger.error("  • Check MongoDB Status: https://status.mongodb.com/")
        logger.error("    If red alerts exist, MongoDB might be down")
        logger.error("")
        logger.error("🔗 DETAILED GUIDE:")
        logger.error("  See: MONGODB_ATLAS_TROUBLESHOOTING.md in project root")
    
    logger.error("=" * 80 + "\n")
    
    raise RuntimeError(
        f"Failed to connect to {connection_type} after 3 attempts. "
        f"Please check the troubleshooting steps in the logs above."
    )

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
