import os
from dataclasses import dataclass

import httpx
import pytest


def _strip_slash(value: str) -> str:
    return value.rstrip("/")


@dataclass
class UserCredentials:
    email: str
    password: str


@pytest.fixture(scope="session")
def api_base_url() -> str:
    return _strip_slash(os.getenv("IVEP_API_BASE_URL", "http://127.0.0.1:8000"))


@pytest.fixture(scope="session")
def api_v1_url(api_base_url: str) -> str:
    return f"{api_base_url}/api/v1"


@pytest.fixture(scope="session")
def frontend_base_url() -> str:
    return _strip_slash(os.getenv("IVEP_FRONTEND_BASE_URL", "http://127.0.0.1:3000"))


def _load_role_credentials(role: str) -> UserCredentials:
    role_upper = role.upper()
    email = os.getenv(f"IVEP_{role_upper}_EMAIL")
    password = os.getenv(f"IVEP_{role_upper}_PASSWORD")
    if not email or not password:
        pytest.skip(f"Missing credentials for role '{role}'. Set IVEP_{role_upper}_EMAIL and IVEP_{role_upper}_PASSWORD.")
    return UserCredentials(email=email, password=password)


@pytest.fixture(scope="session")
def admin_credentials() -> UserCredentials:
    return _load_role_credentials("admin")


@pytest.fixture(scope="session")
def organizer_credentials() -> UserCredentials:
    return _load_role_credentials("organizer")


@pytest.fixture(scope="session")
def enterprise_credentials() -> UserCredentials:
    return _load_role_credentials("enterprise")


@pytest.fixture(scope="session")
def visitor_credentials() -> UserCredentials:
    return _load_role_credentials("visitor")


def login(api_v1_url: str, creds: UserCredentials) -> dict:
    resp = httpx.post(
        f"{api_v1_url}/auth/login",
        json={"email": creds.email, "password": creds.password},
        timeout=20,
    )
    assert resp.status_code == 200, f"Login failed for {creds.email}: {resp.status_code} {resp.text}"
    return resp.json()


@pytest.fixture(scope="session")
def admin_auth(api_v1_url: str, admin_credentials: UserCredentials) -> dict:
    return login(api_v1_url, admin_credentials)


@pytest.fixture(scope="session")
def organizer_auth(api_v1_url: str, organizer_credentials: UserCredentials) -> dict:
    return login(api_v1_url, organizer_credentials)


@pytest.fixture(scope="session")
def enterprise_auth(api_v1_url: str, enterprise_credentials: UserCredentials) -> dict:
    return login(api_v1_url, enterprise_credentials)


@pytest.fixture(scope="session")
def visitor_auth(api_v1_url: str, visitor_credentials: UserCredentials) -> dict:
    return login(api_v1_url, visitor_credentials)
