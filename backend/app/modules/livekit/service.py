"""
LiveKit service for IVEP.

Provides token generation and room management for one-to-one meetings
and one-to-many conference sessions.

Includes auto-start of the local livekit-server process when needed.
"""
import asyncio
import os
import subprocess
import sys
import time
import logging
from datetime import timedelta
from pathlib import Path
from typing import Optional

from livekit.api import AccessToken, VideoGrants, LiveKitAPI
from livekit.protocol.room import CreateRoomRequest, DeleteRoomRequest
from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Auto-start LiveKit server ─────────────────────────────────────────────────

_livekit_process: Optional[subprocess.Popen] = None


def _find_livekit_binary() -> Optional[str]:
    """Locate livekit-server executable relative to the project root."""
    # Project root is two levels up from backend/app/modules/livekit/
    backend_dir = Path(__file__).resolve().parent.parent.parent.parent  # backend/
    project_root = backend_dir.parent  # project root

    candidates = [
        project_root / "livekit_1.9.12_windows_amd64" / "livekit-server.exe",
        project_root / "livekit_1.9.12_windows_amd64" / "livekit-server",
        project_root / "livekit-server.exe",
        project_root / "livekit-server",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return None


async def _is_livekit_reachable() -> bool:
    """Quick health check via HTTP GET to the LiveKit server URL."""
    import aiohttp
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(settings.LIVEKIT_URL, timeout=aiohttp.ClientTimeout(total=2)) as resp:
                return resp.status == 200
    except Exception:
        return False


async def ensure_livekit_running() -> bool:
    """
    Make sure a LiveKit server is reachable.
    If not, attempt to start the local binary in dev mode.
    Returns True when the server is ready.
    """
    global _livekit_process

    # Already reachable? Nothing to do.
    if await _is_livekit_reachable():
        return True

    # If we previously spawned a process that died, clear it
    if _livekit_process is not None and _livekit_process.poll() is not None:
        _livekit_process = None

    # Already started by us and still alive — wait a bit for it to become ready
    if _livekit_process is not None:
        for _ in range(10):
            await asyncio.sleep(0.5)
            if await _is_livekit_reachable():
                return True
        return False

    # Try to start the binary
    binary = _find_livekit_binary()
    if not binary:
        logger.warning("LiveKit binary not found — cannot auto-start")
        return False

    logger.info("Auto-starting LiveKit server: %s --dev", binary)
    try:
        creation_flags = 0
        if sys.platform == "win32":
            creation_flags = subprocess.CREATE_NO_WINDOW

        _livekit_process = subprocess.Popen(
            [binary, "--dev"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            creationflags=creation_flags,
        )
        logger.info("LiveKit process spawned (pid=%d)", _livekit_process.pid)
    except Exception as exc:
        logger.error("Failed to start LiveKit server: %s", exc)
        return False

    # Wait for it to become reachable (up to 12 seconds)
    for i in range(24):
        await asyncio.sleep(0.5)
        if _livekit_process.poll() is not None:
            stderr_out = _livekit_process.stderr.read().decode(errors="replace") if _livekit_process.stderr else ""
            logger.error("LiveKit process exited early (code=%s): %s", _livekit_process.returncode, stderr_out[:500])
            _livekit_process = None
            return False
        if await _is_livekit_reachable():
            logger.info("LiveKit server is ready (pid=%d, after %.1fs)", _livekit_process.pid, (i + 1) * 0.5)
            return True

    logger.error("LiveKit server started but not reachable after timeout (pid=%d)", _livekit_process.pid)
    return False


def _make_token(
    room_name: str,
    user_id: str,
    user_name: str,
    can_publish: bool,
    can_publish_data: bool = True,
    ttl_seconds: int = 3600,
) -> str:
    """Build a signed LiveKit JWT access token."""
    grant = VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=can_publish,
        can_subscribe=True,
        can_publish_data=can_publish_data,
    )
    token = (
        AccessToken(api_key=settings.LIVEKIT_API_KEY, api_secret=settings.LIVEKIT_API_SECRET)
        .with_identity(user_id)
        .with_name(user_name)
        .with_grants(grant)
        .with_ttl(timedelta(seconds=ttl_seconds))
        .to_jwt()
    )
    return token


def generate_meeting_token(room_name: str, user_id: str, user_name: str) -> str:
    """Token for 1-to-1 meeting — both directions allowed."""
    return _make_token(room_name, user_id, user_name, can_publish=True)


def generate_speaker_token(room_name: str, user_id: str, user_name: str) -> str:
    """Token for conference speaker — can publish video/audio."""
    return _make_token(room_name, user_id, user_name, can_publish=True)


def generate_audience_token(room_name: str, user_id: str, user_name: str) -> str:
    """Token for conference audience — subscribe only, can send data (Q&A)."""
    return _make_token(room_name, user_id, user_name, can_publish=False)


async def create_room(room_name: str) -> bool:
    """Create a LiveKit room via the server API. Returns True on success."""
    # Auto-start LiveKit if not running
    if not await ensure_livekit_running():
        logger.error("LiveKit server is not available — cannot create room")
        return False

    try:
        async with LiveKitAPI(
            url=settings.LIVEKIT_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        ) as lkapi:
            await lkapi.room.create_room(
                CreateRoomRequest(
                    name=room_name,
                    empty_timeout=300,
                    max_participants=500,
                )
            )
            return True
    except Exception as exc:
        logger.error("LiveKit create_room(%s) failed: %s", room_name, exc)
        return False


async def delete_room(room_name: str) -> bool:
    """Delete a LiveKit room."""
    try:
        async with LiveKitAPI(
            url=settings.LIVEKIT_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        ) as lkapi:
            await lkapi.room.delete_room(DeleteRoomRequest(room=room_name))
            return True
    except Exception as exc:
        logger.error("LiveKit delete_room(%s) failed: %s", room_name, exc)
        return False
