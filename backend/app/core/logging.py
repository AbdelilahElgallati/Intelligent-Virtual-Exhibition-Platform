"""
Logging configuration module for IVEP backend.
Provides standardized logging setup for the application.
"""

import logging
import sys
from typing import Optional

from app.core.config import get_settings


def setup_logging(log_level: Optional[str] = None) -> None:
    """
    Configure application logging.
    
    Sets up console logging with a clean formatter.
    Log level is determined by settings or can be overridden.
    
    Args:
        log_level: Optional override for log level.
    """
    settings = get_settings()
    
    # Determine log level based on settings
    if log_level is None:
        log_level = "DEBUG" if settings.DEBUG else "INFO"
    
    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Configure console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)
    
    # Set uvicorn loggers to same level
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.handlers.clear()


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the specified name.
    
    Args:
        name: Name for the logger (typically __name__).
        
    Returns:
        logging.Logger: Configured logger instance.
    """
    return logging.getLogger(name)
