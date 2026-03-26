from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.dependencies import require_roles
from app.modules.auth.enums import Role
from app.modules.events.service import get_event_by_id, resolve_event_id
from app.modules.stands.schemas import StandCreate, StandRead, StandUpdate
from app.modules.stands.service import (
    create_stand, 
    get_stand_by_org, 
    list_event_stands, 
    update_stand,
    resolve_stand_id
)


router = APIRouter(prefix="/events/{event_id}/stands", tags=["Stands"])


@router.post("", response_model=StandRead, status_code=status.HTTP_201_CREATED)
async def assign_stand_to_organization(
    event_id: str,
    data: StandCreate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> StandRead:
    """
    Assign a stand to an enterprise organization.
    """
    event_id = await resolve_event_id(event_id)
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Check ownership for organizers
    if current_user["role"] != Role.ADMIN and event["organizer_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # Check if org already has a stand
    existing = await get_stand_by_org(event_id, data.organization_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization already has a stand at this event",
        )
    
    stand = await create_stand(
        event_id, data.organization_id, data.name,
        description=data.description,
        logo_url=data.logo_url,
        tags=data.tags,
        stand_type=data.stand_type,
        category=data.category,
        theme_color=data.theme_color,
        stand_background_url=data.stand_background_url,
        presenter_avatar_bg=data.presenter_avatar_bg,
        presenter_name=data.presenter_name,
        presenter_avatar_url=data.presenter_avatar_url,
    )
    return StandRead(**stand)


@router.get("")
async def get_event_stands(
    event_id: str,
    category: str | None = Query(None, description="Filter by category"),
    search: str | None = Query(None, description="Search stands by name"),
    tags: str | None = Query(None, description="Comma-separated tags to filter by"),
    limit: int = Query(9, ge=1, le=50, description="Number of stands to return"),
    skip: int = Query(0, ge=0, description="Number of stands to skip"),
):
    """
    List all stands for an event.
    """
    event_id = await resolve_event_id(event_id)
    event = await get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Parse tags if provided
    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    
    result = await list_event_stands(
        event_id,
        category=category,
        search=search,
        tags=tags_list,
        limit=limit,
        skip=skip,
    )

    items = result["items"]

    # Enrich stand branding/category/tags from organization profile if missing on stand.
    from app.db.mongo import get_database
    from app.db.utils import stringify_object_ids
    from bson import ObjectId

    db = get_database()
    org_ids = list({str(s.get("organization_id") or "") for s in items if s.get("organization_id")})
    org_map: dict[str, dict] = {}
    for org_id in org_ids:
        if not org_id:
            continue
        org_doc = await db.organizations.find_one({"_id": ObjectId(org_id)}) if ObjectId.is_valid(org_id) else None
        if not org_doc:
            org_doc = await db.organizations.find_one({"_id": org_id})
        if org_doc:
            org_map[org_id] = stringify_object_ids(org_doc)

    for stand in items:
        org = org_map.get(str(stand.get("organization_id") or ""), {})
        if org.get("banner_url"):
            stand["banner_url"] = org["banner_url"]
        if org.get("logo_url"):
            stand["logo_url"] = org["logo_url"]
        if stand.get("category") in (None, "") and org.get("category"):
            stand["category"] = org["category"]
        if (not stand.get("tags")) and org.get("tags"):
            stand["tags"] = org["tags"]
    
    # Convert items to StandRead
    return {
        "items": [StandRead(**s) for s in items],
        "total": result["total"],
        "limit": result["limit"],
        "skip": result["skip"],
    }


@router.get("/{stand_id}", response_model=StandRead)
async def get_stand(event_id: str, stand_id: str) -> StandRead:
    """
    Get stand details by ID or Slug.
    """
    # event_id is captured from prefix but we might not need to resolve it 
    # if we only care about the stand_id, but it's safer to ensure the path is consistent.
    # We resolve it mainly to satisfy the requirement of 'no raw IDs in URL'.
    stand_id = await resolve_stand_id(stand_id)
    
    from app.modules.stands.service import get_stand_by_id
    
    stand = await get_stand_by_id(stand_id)
    if stand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")

    # Enrich with organization cover/logo so visitor view can use enterprise profile branding.
    from app.db.mongo import get_database
    from app.db.utils import stringify_object_ids
    from bson import ObjectId

    db = get_database()
    org_ref = str(stand.get("organization_id") or "")
    org_doc = None
    if org_ref:
        if ObjectId.is_valid(org_ref):
            org_doc = await db.organizations.find_one({"_id": ObjectId(org_ref)})
        if not org_doc:
            org_doc = await db.organizations.find_one({"_id": org_ref})

    if org_doc:
        org = stringify_object_ids(org_doc)
        if org.get("banner_url"):
            stand["banner_url"] = org["banner_url"]
        if org.get("logo_url"):
            stand["logo_url"] = org["logo_url"]
        if stand.get("category") in (None, "") and org.get("category"):
            stand["category"] = org["category"]
        if (not stand.get("tags")) and org.get("tags"):
            stand["tags"] = org["tags"]
            
    return StandRead(**stand)


@router.patch("/{stand_id}", response_model=StandRead)
async def update_stand_endpoint(
    event_id: str,
    stand_id: str,
    data: StandUpdate,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.ORGANIZER])),
) -> StandRead:
    """
    Update stand details.
    """
    stand_id = await resolve_stand_id(stand_id)
    from app.modules.stands.service import get_stand_by_id
    
    stand = await get_stand_by_id(stand_id)
    if stand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stand not found")
    
    updated = await update_stand(stand_id, data.model_dump(exclude_unset=True))
    return StandRead(**updated)
