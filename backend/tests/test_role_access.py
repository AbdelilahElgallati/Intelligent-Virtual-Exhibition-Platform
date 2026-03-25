import httpx


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_admin_only_requires_admin(
    api_v1_url: str,
    admin_auth: dict,
    organizer_auth: dict,
    enterprise_auth: dict,
    visitor_auth: dict,
):
    endpoint = f"{api_v1_url}/auth/admin-only"
    ok = httpx.get(endpoint, headers=_bearer(admin_auth["access_token"]), timeout=20)
    assert ok.status_code == 200, ok.text

    for auth in [organizer_auth, enterprise_auth, visitor_auth]:
        denied = httpx.get(endpoint, headers=_bearer(auth["access_token"]), timeout=20)
        assert denied.status_code in {401, 403}, denied.text


def test_organizer_only_requires_organizer(
    api_v1_url: str,
    admin_auth: dict,
    organizer_auth: dict,
    enterprise_auth: dict,
    visitor_auth: dict,
):
    endpoint = f"{api_v1_url}/auth/organizer-only"
    ok = httpx.get(endpoint, headers=_bearer(organizer_auth["access_token"]), timeout=20)
    assert ok.status_code == 200, ok.text

    for auth in [admin_auth, enterprise_auth, visitor_auth]:
        denied = httpx.get(endpoint, headers=_bearer(auth["access_token"]), timeout=20)
        assert denied.status_code in {401, 403}, denied.text
