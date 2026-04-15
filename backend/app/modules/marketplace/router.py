"""
Configuration module for IVEP backend.
Loads environment variables and provides application settings.
"""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """

    # App Settings
    APP_NAME: str = "Intelligent Virtual Exhibition Platform"
    ENV: Literal["dev", "prod", "production"] = "prod"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]  # Override in production

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        """Allow CORS_ORIGINS as JSON array or comma-separated string."""
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("[") and raw.endswith("]"):
                # Let pydantic parse JSON-like list strings.
                return value
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        return value

    # Security / JWT  (loaded from .env)
    JWT_SECRET_KEY: str = ""  # Preferred variable
    JWT_SECRET: str = ""  # Backward-compatible alias
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes (was 7 days - too long)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7 days for refresh tokens

    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "ivep_db"

    # Stripe Payment Gateway
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # Daily.co (cloud-hosted WebRTC — replace LiveKit)
    DAILY_API_KEY: str = ""
    DAILY_DOMAIN: str = ""  # e.g. yourapp.daily.co

    # Cloudflare R2 Object Storage
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_ENDPOINT: str = ""
    R2_PUBLIC_BASE_URL: str = ""

    # Pydantic Config
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"
    
    def __init__(self, **data):
        super().__init__(**data)
        # Backward compatibility: accept JWT_SECRET when JWT_SECRET_KEY is not provided.
        if not self.JWT_SECRET_KEY and self.JWT_SECRET:
            self.JWT_SECRET_KEY = self.JWT_SECRET
        # Normalize alias so the rest of the app can rely on a single prod value.
        if self.ENV == "production":
            self.ENV = "prod"
        # Validate critical production requirements
        if self.ENV == "prod":
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == "your-super-secret-key-change-in-production":
                raise ValueError("JWT_SECRET_KEY must be set to a strong random value in production")
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")
            if not self.MONGO_URI or "localhost" in self.MONGO_URI:
                raise ValueError("MONGO_URI must be set to MongoDB Atlas in production")
            if not self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS must include your frontend domain(s) in production")
            if not self.FRONTEND_URL:
                raise ValueError("FRONTEND_URL must be set in production")
            if not self.STRIPE_SECRET_KEY:
                raise ValueError("STRIPE_SECRET_KEY must be set in production")
            if not self.STRIPE_WEBHOOK_SECRET:
                raise ValueError("STRIPE_WEBHOOK_SECRET must be set in production")
            if not self.DAILY_API_KEY:
                raise ValueError("DAILY_API_KEY must be set in production for meetings and conferences")
            if not self.DAILY_DOMAIN:
                raise ValueError("DAILY_DOMAIN must be set in production for Daily room URLs")
        # Validate dev requirements
        if self.ENV == "dev":
            self.DEBUG = True  # Always debug in dev


@lru_cache
def get_settings() -> Settings:
    """
    Return a cached Settings instance.
    """
    return Settings()


# Optional direct instance (if you prefer importing settings directly)
settings = get_settings()