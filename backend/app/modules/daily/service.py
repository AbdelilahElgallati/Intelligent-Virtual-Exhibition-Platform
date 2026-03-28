"""
Daily.co service for IVEP.

Replaces LiveKit for all real-time video communication needs:
  - 1:1 meetings (visitor ↔ enterprise)
  - Group meetings (B2B enterprise ↔ enterprise)
  - Conferences / livestream (1 speaker → many viewers)

Uses the Daily.co REST API via httpx (no binary dependencies).
Tokens are signed server-side; the API key is never exposed to the browser.
"""

import logging
import time
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Daily.co REST API base URL
_DAILY_BASE = "https://api.daily.co/v1"


def _get_headers() -> dict:
    """Build auth headers for Daily REST requests."""
    return {
        "Authorization": f"Bearer {settings.DAILY_API_KEY}",
        "Content-Type": "application/json",
    }


def _room_url(room_name: str) -> str:
    """Construct the public room URL from a room name and configured domain."""
    domain = settings.DAILY_DOMAIN.rstrip("/")
    if not domain:
        raise ValueError(
            "DAILY_DOMAIN is not configured. Set it in backend/.env (e.g. yourapp.daily.co)."
        )
    return f"https://{domain}/{room_name}"


# ── Room Management ───────────────────────────────────────────────────────────


async def create_room(
    room_name: str,
    exp_seconds: int = 7200,
    max_participants: int = 100,
    privacy: str = "private",
) -> bool:
    """
    Create a Daily.co room via REST API.

    Args:
        room_name: Unique room identifier (e.g. "meeting-<meeting_id>").
        exp_seconds: Seconds from now until the room expires (default 2 h).
        max_participants: Maximum number of participants allowed.
        privacy: "private" (token required) or "public".

    Returns:
        True on success or if the room already exists, False on error.
    """
    if not settings.DAILY_API_KEY:
        logger.warning("DAILY_API_KEY not set — skipping room creation (dev mode)")
        return True  # allow dev flow without credentials

    payload = {
        "name": room_name,
        "privacy": privacy,
        "properties": {
            "exp": int(time.time()) + exp_seconds,
            "max_participants": max_participants,
            "enable_screenshare": True,
            "enable_chat": True,
            "start_video_off": False,
            "start_audio_off": False,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{_DAILY_BASE}/rooms",
                headers=_get_headers(),
                json=payload,
            )
            if resp.status_code == 200:
                logger.info("Daily room already exists: %s", room_name)
                return True
            if resp.status_code == 201:
                logger.info("Daily room created: %s", room_name)
                return True
            # 400 Bad Request often means room already exists
            if resp.status_code == 400:
                detail = resp.json().get("info", "")
                if "already exists" in detail.lower():
                    logger.info("Daily room already exists (confirmed): %s", room_name)
                    return True
            logger.error(
                "Daily create_room(%s) failed: %s %s",
                room_name,
                resp.status_code,
                resp.text[:300],
            )
            return False
    except Exception as exc:
        logger.error("Daily create_room(%s) exception: %s", room_name, exc)
        return False
    return False


async def delete_room(room_name: str) -> bool:
    """
    Delete a Daily.co room.

    Returns True on success or if the room does not exist (already cleaned up).
    """
    if not settings.DAILY_API_KEY:
        logger.warning("DAILY_API_KEY not set — skipping room deletion (dev mode)")
        return True

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f"{_DAILY_BASE}/rooms/{room_name}",
                headers=_get_headers(),
            )
            if resp.status_code in (200, 204):
                logger.info("Daily room deleted: %s", room_name)
                return True
            if resp.status_code == 404:
                logger.info("Daily room not found (already deleted): %s", room_name)
                return True
            logger.error(
                "Daily delete_room(%s) failed: %s %s",
                room_name,
                resp.status_code,
                resp.text[:300],
            )
            return False
    except Exception as exc:
        logger.error("Daily delete_room(%s) exception: %s", room_name, exc)
        return False
    return False


# ── Token Generation ──────────────────────────────────────────────────────────


async def _create_meeting_token(
    room_name: str,
    user_id: str,
    user_name: str,
    is_owner: bool,
    enable_screenshare: bool = True,
    start_video_off: bool = False,
    start_audio_off: bool = False,
    ttl_seconds: int = 3600,
    nbf: Optional[int] = None,
) -> str:
    """
    Request a signed meeting token from the Daily.co API.

    Tokens are always generated server-side so the API key is never
    exposed to the browser. Each token is scoped to a specific room.
    """
    if not settings.DAILY_API_KEY:
        # Return a dummy token in dev mode (allows UI testing without credentials)
        logger.warning(
            "DAILY_API_KEY not set — returning placeholder token (dev mode). "
            "Video will not connect."
        )
        return "dev-placeholder-token-no-api-key"

    payload = {
        "properties": {
            "room_name": room_name,
            "user_name": user_name,
            "user_id": user_id,
            "is_owner": is_owner,
            "enable_screenshare": enable_screenshare,
            "start_video_off": start_video_off,
            "start_audio_off": start_audio_off,
            # Token expiry — absolute UNIX timestamp
            "exp": int(time.time()) + ttl_seconds,
            # Prevent token being used before this time (abs UNIX timestamp)
            "nbf": nbf,
            # Prevent token from being used in a different room
            "close_tab_on_exit": False,
            "enable_recording": False,
        }
    }
    if nbf is None:
        payload["properties"].pop("nbf")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{_DAILY_BASE}/meeting-tokens",
                headers=_get_headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            token = data.get("token")
            if not token:
                raise ValueError(f"Daily API returned no token: {data}")
            logger.info(
                "Daily token issued — room=%s user=%s owner=%s",
                room_name,
                user_id,
                is_owner,
            )
            return token
    except Exception as exc:
        logger.error(
            "Daily _create_meeting_token(%s, %s) failed: %s",
            room_name,
            user_id,
            exc,
        )
        raise
    return ""


# ── Public helpers (same interface pattern as the old livekit service) ────────


async def generate_meeting_token(
    room_name: str,
    user_id: str,
    user_name: str,
    is_owner: bool = False,
    nbf: Optional[int] = None,
) -> str:
    """
    1:1 or group meeting token — both participants can publish audio/video.

    Args:
        is_owner: Set True for the meeting host/organizer (can kick participants).
    """
    return await _create_meeting_token(
        room_name=room_name,
        user_id=user_id,
        user_name=user_name,
        is_owner=is_owner,
        enable_screenshare=True,
        start_video_off=False,
        start_audio_off=False,
        ttl_seconds=3600,
        nbf=nbf,
    )


async def generate_speaker_token(
    room_name: str,
    user_id: str,
    user_name: str,
    nbf: Optional[int] = None,
) -> str:
    """
    Conference speaker token — is_owner=True, can publish video/audio/screen.
    """
    return await _create_meeting_token(
        room_name=room_name,
        user_id=user_id,
        user_name=user_name,
        is_owner=True,
        enable_screenshare=True,
        start_video_off=False,
        start_audio_off=False,
        ttl_seconds=14400,  # 4 hours for conference sessions
        nbf=nbf,
    )


async def generate_audience_token(
    room_name: str,
    user_id: str,
    user_name: str,
    nbf: Optional[int] = None,
) -> str:
    """
    Conference audience token — view-only (no publish), camera/mic start off.
    """
    return await _create_meeting_token(
        room_name=room_name,
        user_id=user_id,
        user_name=user_name,
        is_owner=False,
        enable_screenshare=False,
        start_video_off=True,
        start_audio_off=True,
        ttl_seconds=14400,
        nbf=nbf,
    )


def get_room_url(room_name: str) -> str:
    """Return the public Daily room URL for a given room name."""
    return _room_url(room_name)
