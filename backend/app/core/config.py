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
    """
    
    APP_NAME: str = "Intelligent Virtual Exhibition Platform"
    ENV: Literal["dev", "prod"] = "dev"
    DEBUG: bool = True
    
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
