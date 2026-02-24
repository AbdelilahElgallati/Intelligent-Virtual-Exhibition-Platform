"""
Admin-specific routes: /admin/health
"""
import time
import os
from fastapi import APIRouter, Depends
from datetime import datetime, timezone

from app.core.dependencies import require_role
from app.modules.auth.enums import Role
from app.db.mongo import get_database

router = APIRouter(prefix="/admin", tags=["Admin"])

# Record process start time for uptime calculation
_START_TIME = time.time()


@router.get("/health")
async def admin_health(
    _: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Detailed platform health status (Admin only).
    Returns MongoDB connection status, uptime, and worker/process info.
    """
    # MongoDB ping
    mongo_ok = False
    mongo_latency_ms = None
    try:
        db = get_database()
        t0 = time.monotonic()
        await db.command("ping")
        mongo_latency_ms = round((time.monotonic() - t0) * 1000, 1)
        mongo_ok = True
    except Exception as e:
        mongo_latency_ms = None

    uptime_seconds = int(time.time() - _START_TIME)
    uptime_str = _format_uptime(uptime_seconds)

    # Redis — we don't have redis configured yet, report as "not configured"
    redis_status = "not_configured"

    overall = "healthy" if mongo_ok else "degraded"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": uptime_str,
        "uptime_seconds": uptime_seconds,
        "services": {
            "mongodb": {
                "status": "ok" if mongo_ok else "error",
                "latency_ms": mongo_latency_ms,
            },
            "redis": {
                "status": redis_status,
                "latency_ms": None,
            },
            "api": {
                "status": "ok",
                "pid": os.getpid(),
            },
        },
    }


def _format_uptime(seconds: int) -> str:
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    if days:
        return f"{days}d {hours}h {minutes}m"
    if hours:
        return f"{hours}h {minutes}m {secs}s"
    return f"{minutes}m {secs}s"
