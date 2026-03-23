"""
Rate limiting middleware for IVEP backend.
Protects against brute force and DoS attacks on sensitive endpoints.
"""

import time
from typing import Dict, Tuple
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from .config import settings

logger = logging.getLogger(__name__)


class RateLimitStore:
    """
    In-memory rate limit store.
    For production, use Redis or a distributed cache.
    """
    def __init__(self):
        self.requests: Dict[str, list[float]] = {}
    
    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        """
        Check if request is allowed under rate limit.
        
        Args:
            key: Identifier (IP, user_id, etc.)
            limit: Max requests allowed
            window: Time window in seconds
        
        Returns:
            True if request allowed, False if rate limited
        """
        now = time.time()
        
        if key not in self.requests:
            self.requests[key] = []
        
        # Remove old requests outside the window
        self.requests[key] = [req_time for req_time in self.requests[key] 
                              if now - req_time < window]
        
        # Check if limit exceeded
        if len(self.requests[key]) >= limit:
            return False
        
        # Record this request
        self.requests[key].append(now)
        return True


# Global rate limit store
_rate_limit_store = RateLimitStore()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware for FastAPI.
    """
    
    # Sensitive endpoints with strict rate limits
    STRICT_RATE_LIMITS = {
        "/api/v1/auth/login": (20, 300),        # 20 requests per 5 minutes
        "/api/v1/auth/register": (20, 3600),    # 20 requests per hour
        "/api/v1/auth/refresh": (10, 300),     # 10 requests per 5 minutes
        "/api/v1/users/me": (100, 60),         # 100 requests per minute
    }
    
    # Default rate limits for other endpoints
    DEFAULT_LIMIT = 1000  # requests per minute
    
    async def dispatch(self, request: Request, call_next):
        """
        Check rate limit before processing request.
        """
        # Do not throttle requests during local development.
        if settings.DEBUG:
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Check if this is a strict endpoint
        path = request.url.path
        for strict_path, (limit, window) in self.STRICT_RATE_LIMITS.items():
            if path.startswith(strict_path):
                key = f"{client_ip}:{path}"
                if not _rate_limit_store.is_allowed(key, limit, window):
                    logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"detail": "Too many requests. Please try again later."},
                        headers={"Retry-After": str(window)},
                    )
                break
        
        return await call_next(request)


def check_rate_limit(
    identifier: str,
    limit: int = 100,
    window: int = 60,
) -> bool:
    """
    Manual rate limit check for specific operations.
    
    Args:
        identifier: Unique identifier (user_id, email, etc.)
        limit: Max operations allowed
        window: Time window in seconds
    
    Returns:
        True if allowed, False if rate limited
    """
    return _rate_limit_store.is_allowed(identifier, limit, window)
