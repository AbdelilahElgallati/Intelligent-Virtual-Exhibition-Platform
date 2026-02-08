"""
Configuration module for IVEP backend.

Loads environment variables and provides application settings.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Attributes:
        APP_NAME: Name of the application.
        ENV: Environment mode (dev or prod).
        DEBUG: Enable debug mode.
        JWT_SECRET_KEY: Secret key for JWT encoding.
        JWT_ALGORITHM: Algorithm for JWT encoding.
        ACCESS_TOKEN_EXPIRE_MINUTES: Access token expiration time.
        REFRESH_TOKEN_EXPIRE_DAYS: Refresh token expiration time.
    """
    
    APP_NAME: str = "Intelligent Virtual Exhibition Platform"
    ENV: Literal["dev", "prod"] = "dev"
    DEBUG: bool = True
    
    # JWT Settings
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    """
    Get cached application settings.
    
    Returns:
        Settings: Application settings instance.
    """
    return Settings()
