"""
IVEP Backend Application.
Main FastAPI application entry point for the Intelligent Virtual Exhibition Platform.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.db.indexes import ensure_indexes

# Routers (new architecture)
from app.modules.analytics.router import router as analytics_router
from app.modules.auth.router import router as auth_router
from app.modules.events.router import router as events_router
from app.modules.notifications.router import router as notifications_router
from app.modules.organizations.router import router as organizations_router
from app.modules.participants.router import router as participants_router
from app.modules.stands.router import router as stands_router
from app.modules.subscriptions.router import router as subscriptions_router
from app.modules.users.router import router as users_router

# Routers (legacy/extra modules)
from app.modules.chat.router import router as chat_router
from app.modules.ai_rag.router import router as rag_router
from app.modules.ai_translation.router import router as translation_router
from app.modules.transcripts.router import router as transcripts_router
from app.modules.meetings.router import router as meetings_router
from app.modules.resources.router import router as resources_router
from app.modules.leads.router import router as leads_router
from app.modules.recommendations.router import router as recommendations_router
from app.modules.favorites.router import router as favorites_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager.

    Handles startup and shutdown events.
    """
    # Startup
    settings = get_settings()
    setup_logging()
    logger = logging.getLogger(__name__)

    logger.info(f"Starting {settings.APP_NAME}")
    logger.info(f"Environment: {getattr(settings, 'ENV', 'dev')}")
    logger.info(f"Debug mode: {settings.DEBUG}")

    # Connect to MongoDB
    await connect_to_mongo()
    await ensure_indexes()

    yield

    # Shutdown
    await close_mongo_connection()
    logger.info(f"Shutting down {settings.APP_NAME}")


def register_routers(app: FastAPI) -> None:
    """
    Register all application routers.
    """
    settings = get_settings()
    api_prefix = getattr(settings, "API_V1_STR", "/api/v1")

    # New architecture routers
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(users_router, prefix=api_prefix)
    app.include_router(organizations_router, prefix=api_prefix)
    app.include_router(events_router, prefix=api_prefix)
    app.include_router(participants_router, prefix=api_prefix)
    app.include_router(stands_router, prefix=api_prefix)
    app.include_router(subscriptions_router, prefix=api_prefix)
    app.include_router(analytics_router, prefix=api_prefix)
    app.include_router(notifications_router, prefix=api_prefix)
    app.include_router(favorites_router, prefix=api_prefix)

    # Legacy/extra routers (mounted with tags)
    app.include_router(chat_router, prefix=f"{api_prefix}/chat", tags=["chat"])
    app.include_router(rag_router, prefix=f"{api_prefix}/assistant", tags=["assistant"])
    app.include_router(translation_router, prefix=f"{api_prefix}/translation", tags=["translation"])
    app.include_router(transcripts_router, prefix=f"{api_prefix}/transcripts", tags=["transcripts"])
    app.include_router(meetings_router, prefix=f"{api_prefix}/meetings", tags=["meetings"])
    app.include_router(resources_router, prefix=f"{api_prefix}/resources", tags=["resources"])
    app.include_router(leads_router, prefix=f"{api_prefix}/leads", tags=["leads"])
    app.include_router(recommendations_router, prefix=f"{api_prefix}/recommendations", tags=["recommendations"])
    
    # Dev / Seeding
    if settings.ENV == "dev" or settings.DEBUG:
        from app.modules.dev.router import router as dev_router
        app.include_router(dev_router, prefix=api_prefix)

def create_application() -> FastAPI:
    """
    Create and configure the FastAPI application.
    """
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        description="Backend API for the Intelligent Virtual Exhibition Platform",
        version="0.1.0",
        debug=settings.DEBUG,
        openapi_url=f"{getattr(settings, 'API_V1_STR', '/api/v1')}/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    register_routers(app)

    return app


# Create application instance
app = create_application()


@app.get("/", tags=["Root"])
async def read_root() -> dict[str, str]:
    """
    Root endpoint.
    """
    return {"message": "Welcome to IVEP API"}


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """
    Health check endpoint.
    """
    return {"status": "healthy"}
