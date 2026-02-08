"""
Security module for IVEP backend.
Provides password hashing, JWT token creation and validation.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings


# Password hashing (passlib bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """
    Hash a plain text password using bcrypt via passlib.
    """
    return pwd_context.hash(password)


def hash_password(password: str) -> str:
    """
    Backward-compatible alias (some parts may call hash_password()).
    """
    return get_password_hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.
    """
    return pwd_context.verify(plain_password, hashed_password)


# JWT helpers
def _jwt_secret_and_algorithm() -> tuple[str, str]:
    """
    Supports both old and new settings attribute names:
    - New: JWT_SECRET_KEY, JWT_ALGORITHM
    - Old: JWT_SECRET, ALGORITHM
    """
    s = get_settings()
    secret = getattr(s, "JWT_SECRET_KEY", None) or getattr(s, "JWT_SECRET", None)
    algo = getattr(s, "JWT_ALGORITHM", None) or getattr(s, "ALGORITHM", None)

    if not secret or not algo:
        raise RuntimeError("JWT settings are missing (secret or algorithm).")

    return secret, algo


def create_access_token(
    subject: Union[str, Any] = None,
    expires_delta: Optional[timedelta] = None,
    data: Optional[dict[str, Any]] = None,
) -> str:
    """
    Create a JWT access token.

    Supports both styles:
    1) Legacy: create_access_token(subject="user-id")
    2) New:    create_access_token(data={"sub": "...", "role": "..."})
    """
    s = get_settings()
    secret, algo = _jwt_secret_and_algorithm()

    # Build payload
    if data is not None:
        to_encode = data.copy()
    else:
        to_encode = {"sub": str(subject)}

    # Expiration
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=getattr(s, "ACCESS_TOKEN_EXPIRE_MINUTES", 30)
        )

    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, secret, algorithm=algo)


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT refresh token.
    """
    s = get_settings()
    secret, algo = _jwt_secret_and_algorithm()

    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=getattr(s, "REFRESH_TOKEN_EXPIRE_DAYS", 7)
        )

    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, secret, algorithm=algo)


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """
    Decode and validate a JWT token. Returns payload or None if invalid.
    """
    secret, algo = _jwt_secret_and_algorithm()
    try:
        return jwt.decode(token, secret, algorithms=[algo])
    except JWTError:
        return None


def verify_token_type(token: str, expected_type: str) -> Optional[dict[str, Any]]:
    """
    Verify token type ('access' or 'refresh') and decode.
    """
    payload = decode_token(token)
    if payload is None:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload
