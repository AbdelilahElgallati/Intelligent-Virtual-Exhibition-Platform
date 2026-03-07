"""
Development module router for IVEP.

Provides endpoints for development and testing, such as data seeding.
RESTRICTED TO DEV ENVIRONMENT.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict
from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.modules.auth.enums import Role
from app.modules.users.service import create_user, get_user_by_email, get_users_collection
from app.modules.organizations.service import create_organization, add_organization_member
from app.modules.organizations.schemas import OrganizationCreate, OrgMemberRole
from app.modules.events.service import create_event, update_event, update_event_state
from app.modules.events.schemas import EventCreate, EventState, EventUpdate
from app.modules.stands.service import create_stand
from app.modules.resources.repository import resource_repo
from app.modules.resources.schemas import ResourceCreate, ResourceType


router = APIRouter(prefix="/dev", tags=["Development"])


class SeedingSummary(BaseModel):
    users_created: int
    organizations_created: int
    events_created: int
    stands_created: int
    resources_created: int
    details: List[str]


@router.post("/seed-data", response_model=SeedingSummary)
async def seed_data():
    """
    Seed the database with realistic test data.
    """
    settings = get_settings()
    if settings.ENV != "dev" and not settings.DEBUG:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding is only available in development environment",
        )

    summary = {
        "users_created": 0,
        "organizations_created": 0,
        "events_created": 0,
        "stands_created": 0,
        "resources_created": 0,
        "details": [],
    }
    
    log = []

    # 1. Create Users
    users_data = [
        {"email": "admin@ivep.com", "full_name": "System Admin", "role": Role.ADMIN},
        {"email": "organizer@ivep.com", "full_name": "Sarah Organizer", "role": Role.ORGANIZER},
        {"email": "techcorp@ivep.com", "full_name": "TechCorp Manager", "role": Role.ENTERPRISE},
        {"email": "ecosoft@ivep.com", "full_name": "EcoSoft CEO", "role": Role.ENTERPRISE},
        {"email": "edusys@ivep.com", "full_name": "EduSys Rep", "role": Role.ENTERPRISE},
        {"email": "visitor1@ivep.com", "full_name": "John Visitor", "role": Role.VISITOR},
        {"email": "visitor2@ivep.com", "full_name": "Jane Doe", "role": Role.VISITOR},
        {"email": "visitor3@ivep.com", "full_name": "Alice Smith", "role": Role.VISITOR},
    ]
    
    created_users = {} # email -> id
    
    from uuid import uuid4
    
    for u_data in users_data:
        existing = await get_user_by_email(u_data["email"])
        if existing:
            # Fix missing ID if necessary
            if "id" not in existing:
                existing["id"] = str(uuid4())
                await get_users_collection().update_one(
                    {"email": u_data["email"]},
                    {"$set": {"id": existing["id"]}}
                )
                log.append(f"Fixed missing ID for user {u_data['email']}")
                
            created_users[u_data["email"]] = existing["id"]
            log.append(f"User {u_data['email']} already exists.")
            continue
            
        new_id = str(uuid4())
        new_user = {
            "id": new_id,
            "email": u_data["email"],
            "full_name": u_data["full_name"],
            "hashed_password": get_password_hash("password123"), # Default password
            "role": u_data["role"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            # Visitor specific
            "interests": ["AI", "Technology"] if u_data["role"] == Role.VISITOR else [],
            "title": "Visitor" if u_data["role"] == Role.VISITOR else "Manager",
            "company": "External" if u_data["role"] == Role.VISITOR else None,
        }
        
        await create_user(new_user)
        created_users[u_data["email"]] = new_id
        summary["users_created"] += 1
        log.append(f"Created user {u_data['email']}")

    # 2. Create Organizations
    orgs_data = [
        {
            "name": "IVEP Events",
            "description": "Global event organizer.",
            "owner_email": "organizer@ivep.com",
            "industry": "Events"
        },
        {
            "name": "TechCorp AI",
            "description": "Leading AI solutions for enterprise.",
            "owner_email": "techcorp@ivep.com",
            "industry": "Artificial Intelligence"
        },
        {
            "name": "EcoSoft Solutions",
            "description": "Sustainable software for a greener planet.",
            "owner_email": "ecosoft@ivep.com",
            "industry": "Sustainability"
        },
        {
            "name": "EduSys Global",
            "description": "Revolutionizing education with technology.",
            "owner_email": "edusys@ivep.com",
            "industry": "EdTech"
        }
    ]
    
    created_orgs = {} # name -> id
    
    for o_data in orgs_data:
        # Check if org exists? I don't have get_org_by_name. 
        # For simplicity, if owner already has org? No, multiple orgs allowed maybe.
        # I'll rely on idempotency check in service if created?
        # Actually create_organization creates a NEW ID every time.
        # I should check logic.
        # Ideally I should check if name exists, but I lack that function efficiently exposed.
        # I will assume if I just created the user, I can create the org.
        # BUT if I rerun the script, I'll duplicate orgs.
        # I'll just create them and report it.
        # Refinement: To avoid duplicates, maybe I'll skip if I didn't create the user?
        # Or lookup org by owner?
        # get_organizations() list all.
        
        all_orgs = await create_organization.__globals__['list_organizations']() # accessing imported function
        # Better: call imported list_organizations
        from app.modules.organizations.service import list_organizations
        existing_orgs = await list_organizations()
        existing = next((o for o in existing_orgs if o["name"] == o_data["name"]), None)
        
        if existing:
            created_orgs[o_data["name"]] = existing["id"]
            log.append(f"Organization {o_data['name']} already exists.")
            continue
            
        owner_id = created_users.get(o_data["owner_email"])
        if not owner_id:
            continue
            
        org_in = OrganizationCreate(name=o_data["name"], description=o_data["description"])
        org = await create_organization(org_in, UUID(owner_id))
        created_orgs[o_data["name"]] = org["id"]
        summary["organizations_created"] += 1
        log.append(f"Created organization {o_data['name']}")

    # 3. Create Events
    events_data = [
        {
            "title": "AI & Innovation Expo 2026",
            "description": "Explore the future of Artificial Intelligence and Robotics.",
            "organizer_email": "organizer@ivep.com",
            "category": "Technology",
            "banner_url": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=2070"
        },
        {
            "title": "GreenTech Virtual Summit",
            "description": "Solutions for a sustainable future.",
            "organizer_email": "organizer@ivep.com",
            "category": "Sustainability",
            "banner_url": "https://images.unsplash.com/photo-1542601906990-b4d3fb7d5c73?auto=format&fit=crop&q=80&w=2070"
        }
    ]
    
    created_events = {} # title -> id
    
    from app.modules.events.service import list_events
    existing_events = await list_events() # gets all events
    
    for e_data in events_data:
        existing = next((e for e in existing_events if e["title"] == e_data["title"]), None)
        if existing:
            created_events[e_data["title"]] = existing["id"]
            log.append(f"Event {e_data['title']} already exists.")
            continue
            
        organizer_id = created_users.get(e_data["organizer_email"])
        if not organizer_id:
            continue
            
        event_in = EventCreate(title=e_data["title"], description=e_data["description"])
        event = await create_event(event_in, UUID(organizer_id))
        
        # Update extra fields and publish
        update_in = EventUpdate(
            title=e_data["title"] # dummy to satisfy logic
        )
        # Using service update logic to just modify dict fields not exposed in Update schema?
        # EventUpdate has title, description, start_date, end_date. Banner?
        # Schema might be missing banner update.
        # I'll manually check schemas.py later. For now, assuming basic update works.
        # Actually I can update the document directly in mongo if needed for seeding.
        # But let's try to be clean.
        
        # Publish
        await update_event_state(UUID(event["id"]), EventState.LIVE)
        
        # To add banner, I might need direct DB access if update_event doesn't support it.
        # I'll use direct DB for "polishing" the seed data.
        from app.modules.events.service import get_events_collection
        coll = get_events_collection()
        await coll.update_one(
            {"id": event["id"]}, 
            {"$set": {
                "banner_url": e_data["banner_url"],
                "category": e_data["category"],
                "start_date": datetime.now(timezone.utc),
                "end_date": datetime.now(timezone.utc) + timedelta(days=3)
            }}
        )
        
        created_events[e_data["title"]] = event["id"]
        summary["events_created"] += 1
        log.append(f"Created event {e_data['title']}")

    # 4. Create Stands and Resources
    # Map Event -> Stands
    stands_plan = {
        "AI & Innovation Expo 2026": [
            {"org": "TechCorp AI", "tags": ["AI", "Robotics", "Cloud"]},
            {"org": "EduSys Global", "tags": ["EdTech", "Learning", "AI"]},
            {"org": "EcoSoft Solutions", "tags": ["Green Tech", "Computing"]}
        ],
        "GreenTech Virtual Summit": [
             {"org": "EcoSoft Solutions", "tags": ["Sustainability", "Recycling"]},
             {"org": "TechCorp AI", "tags": ["Efficient Computing"]}
        ]
    }
    
    from app.modules.stands.service import list_event_stands, get_stands_collection
    
    for event_title, stand_defs in stands_plan.items():
        event_id = created_events.get(event_title)
        if not event_id:
            continue
            
        existing_stands = await list_event_stands(event_id)
        
        for s_def in stand_defs:
            org_name = s_def["org"]
            org_id = created_orgs.get(org_name)
            if not org_id:
                continue
                
            # Check if stand exists for this org at this event
            existing = next((s for s in existing_stands if str(s["organization_id"]) == str(org_id)), None)
            
            stand_id = None
            if existing:
                stand_id = existing["id"]
            else:
                stand = await create_stand(event_id, org_id, org_name)
                stand_id = stand["id"]
                summary["stands_created"] += 1
                
                # Update stand details (logo, desc, tags)
                s_coll = get_stands_collection()
                await s_coll.update_one(
                    {"id": stand_id},
                    {"$set": {
                        "tags": s_def["tags"],
                        "description": f"Official stand of {org_name} at {event_title}. Innovation and excellence.",
                        "logo_url": f"https://ui-avatars.com/api/?name={org_name.replace(' ', '+')}&background=random",
                        "stand_type": "sponsor" if "TechCorp" in org_name else "standard"
                    }}
                )
                log.append(f"Created stand for {org_name} at {event_title}")

            # 5. Create Resources
            # Check existing resources?
            # resource_repo.get_resources_by_stand(stand_id)
            resources = await resource_repo.get_resources_by_stand(stand_id)
            if not resources:
                # Add Brochure
                res1 = ResourceCreate(
                    title=f"{org_name} Brochure 2026",
                    description="Company overview and product catalog.",
                    type=ResourceType.DOCUMENT,
                    file_path="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                    stand_id=str(stand_id),
                    file_size=1024 * 500,
                    mime_type="application/pdf",
                    tags=["Brochure", "Overview"]
                )
                await resource_repo.create_resource(res1)
                
                # Add Video
                res2 = ResourceCreate(
                    title="Product Demo",
                    description="See our solutions in action.",
                    type=ResourceType.VIDEO,
                    file_path="https://www.youtube.com/watch?v=dQw4w9WgXcQ", 
                    stand_id=str(stand_id),
                    file_size=0,
                    mime_type="video/mp4",
                    tags=["Demo", "Product"]
                )
                await resource_repo.create_resource(res2)
                
                summary["resources_created"] += 2

    summary["details"] = log
    return SeedingSummary(**summary)
