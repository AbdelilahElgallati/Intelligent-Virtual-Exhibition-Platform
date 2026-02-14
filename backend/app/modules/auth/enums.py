from enum import Enum

class Role(str, Enum):
    """User roles in the platform."""
    
    ADMIN = "admin"
    ORGANIZER = "organizer"
    ENTERPRISE = "enterprise"
    VISITOR = "visitor"
