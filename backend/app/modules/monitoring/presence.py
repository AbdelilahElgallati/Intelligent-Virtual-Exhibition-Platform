"""
In-memory presence registry for live WebSocket tracking.

Structure:
    _presence = {
        event_id: {
            user_id: {
                "connected_at": ISO string,
                "full_name": str,
                "role": str,
            }
        }
    }
"""
from datetime import datetime, timezone
from typing import Dict, Optional


# Global registry: event_id -> { user_id -> metadata }
_presence: Dict[str, Dict[str, dict]] = {}


def mark_connected(
    event_id: str,
    user_id: str,
    full_name: str,
    role: str,
) -> None:
    """Register a user as connected to an event's WebSocket session."""
    if event_id not in _presence:
        _presence[event_id] = {}
    _presence[event_id][user_id] = {
        "user_id": user_id,
        "full_name": full_name,
        "role": role,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }


def mark_disconnected(event_id: str, user_id: str) -> None:
    """Remove a user from the presence registry when they disconnect."""
    if event_id in _presence:
        _presence[event_id].pop(user_id, None)
        if not _presence[event_id]:
            del _presence[event_id]


def get_active_users(event_id: str) -> list[dict]:
    """Return list of active users for a given event."""
    return list(_presence.get(event_id, {}).values())


def get_active_count(event_id: str) -> int:
    """Return count of active users for a given event."""
    return len(_presence.get(event_id, {}))


def get_all_presence() -> Dict[str, Dict[str, dict]]:
    """Return the full presence registry (for testing / debugging)."""
    return _presence


def clear_event(event_id: str) -> None:
    """Clear all presence data for an event (e.g. when event closes)."""
    _presence.pop(event_id, None)
