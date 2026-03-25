import httpx
import pytest


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_backend_health(api_base_url: str):
    try:
        resp = httpx.get(f"{api_base_url}/health", timeout=20)
    except httpx.ConnectError:
        pytest.skip(f"Backend is not reachable at {api_base_url}. Start backend or set IVEP_API_BASE_URL.")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("status") in {"healthy", "ok"}


def test_frontend_reachable(frontend_base_url: str):
    try:
        resp = httpx.get(frontend_base_url, timeout=20)
    except httpx.ConnectError:
        pytest.skip(f"Frontend is not reachable at {frontend_base_url}. Start frontend or set IVEP_FRONTEND_BASE_URL.")
    assert resp.status_code < 500


def test_all_roles_can_login_and_get_profile(
    api_v1_url: str,
    admin_auth: dict,
    organizer_auth: dict,
    enterprise_auth: dict,
    visitor_auth: dict,
):
    for auth in [admin_auth, organizer_auth, enterprise_auth, visitor_auth]:
        token = auth["access_token"]
        profile_resp = httpx.get(f"{api_v1_url}/users/me", headers=_bearer(token), timeout=20)
        assert profile_resp.status_code == 200, profile_resp.text
        profile = profile_resp.json()
        assert profile.get("email")
        assert profile.get("role") in {"admin", "organizer", "enterprise", "visitor"}


def test_timezone_persist_roundtrip(api_v1_url: str, visitor_auth: dict):
    token = visitor_auth["access_token"]
    headers = _bearer(token)

    me_before = httpx.get(f"{api_v1_url}/users/me", headers=headers, timeout=20)
    assert me_before.status_code == 200, me_before.text
    original_tz = me_before.json().get("timezone")

    target_tz = "Asia/Tokyo" if original_tz != "Asia/Tokyo" else "Europe/Paris"
    update_resp = httpx.put(
        f"{api_v1_url}/users/me",
        json={"timezone": target_tz},
        headers=headers,
        timeout=20,
    )
    assert update_resp.status_code == 200, update_resp.text

    me_after = httpx.get(f"{api_v1_url}/users/me", headers=headers, timeout=20)
    assert me_after.status_code == 200, me_after.text
    assert me_after.json().get("timezone") == target_tz

    # Restore previous timezone to keep environments stable.
    restore_payload = {"timezone": original_tz or "UTC"}
    restore_resp = httpx.put(
        f"{api_v1_url}/users/me",
        json=restore_payload,
        headers=headers,
        timeout=20,
    )
    assert restore_resp.status_code == 200, restore_resp.text
