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
from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.organizations.router import router as organizations_router
from app.modules.events.router import router as events_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager.
    
    Handles startup and shutdown events.
    
    Args:
        app: FastAPI application instance.
        
    Yields:
        None
    """
    # Startup
    settings = get_settings()
    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info(f"Starting {settings.APP_NAME}")
    logger.info(f"Environment: {settings.ENV}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}")


def create_application() -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    Returns:
        FastAPI: Configured FastAPI application instance.
    """
    settings = get_settings()
    
    app = FastAPI(
        title=settings.APP_NAME,
        description="Backend API for the Intelligent Virtual Exhibition Platform",
        version="0.1.0",
        debug=settings.DEBUG,
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


def register_routers(app: FastAPI) -> None:
    """
    Register all application routers.
    
    Args:
        app: FastAPI application instance.
    """
    api_prefix = "/api/v1"
    
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(users_router, prefix=api_prefix)
    app.include_router(organizations_router, prefix=api_prefix)
    app.include_router(events_router, prefix=api_prefix)


# Create application instance
app = create_application()


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """
    Health check endpoint.
    
    Returns:
        dict: Health status response.
    """
    return {"status": "healthy"}
