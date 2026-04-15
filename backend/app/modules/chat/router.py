from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status
from typing import List
from ...core.dependencies import get_current_user, get_current_user_ws
from .schemas import MessageSchema, ChatRoomSchema, MessageCreate
from .repository import chat_repo
from .service import manager
from datetime import datetime, timezone
import json
from bson import ObjectId
from fastapi.encoders import jsonable_encoder
from app.modules.leads.service import lead_service
from app.modules.leads.schemas import LeadInteraction
from app.modules.participants.service import get_user_participation
from app.modules.analytics.service import log_event_persistent
from app.modules.analytics.schemas import AnalyticsEventType
from app.modules.stands.service import resolve_stand_id
from app.modules.organizations.service import resolve_organization_id
from app.modules.events.service import resolve_event_id, get_event_by_id
from app.core.timezone import timezone_service

router = APIRouter()

@router.get("/rooms", response_model=List[ChatRoomSchema])
async def get_my_rooms(
    event_id: str = None,
    room_category: str = None,
    current_user: dict = Depends(get_current_user),
):
    # Resolve event_id if it's a slug
    resolved_event_id = await resolve_event_id(event_id) if event_id else None
    
    rooms = await chat_repo.get_user_rooms(
        str(current_user["_id"]),
        event_id=resolved_event_id,
        room_category=room_category,
    )
    
    # Enrich rooms with member names
    from app.modules.users.service import get_user_by_id
    from app.db.mongo import get_database
    db = get_database()
    enriched_rooms = []
    for room in rooms:
        other_member_id = next((m for m in room.members if m != str(current_user["_id"])), None)
        if other_member_id:
            if room.room_category == "b2b":
                org_doc = await db.organizations.find_one({"owner_id": other_member_id})
                if not org_doc:
                    # Debug: log available orgs for this owner
                    print(f"No org found for owner_id={other_member_id}")
                    orgs = await db.organizations.find({"owner_id": {"$exists": True}}).to_list(5)
                    print(f"Sample orgs: {[{k: o.get(k) for k in ('_id','owner_id','name')} for o in orgs]}")
                if org_doc:
                    room.name = org_doc.get("name") or "Enterprise"
                else:
                    other_user = await get_user_by_id(other_member_id)
                    if other_user:
                        room.name = other_user.get('full_name') or other_user.get('username') or "Enterprise"
                    else:
                        room.name = f"Enterprise #{other_member_id[:4]}"
            else:
                other_user = await get_user_by_id(other_member_id)
                if other_user:
                    name = other_user.get('username')
                    if not name:
                        name = other_user.get('full_name')
                    if not name and other_user.get('email'):
                        name = other_user.get('email').split('@')[0]
                    room.name = name or "Visitor"
                else:
                    room.name = f"Member #{other_member_id[:4]}"
        else:
            room.name = "Unknown"
        enriched_rooms.append(room)
        
    return enriched_rooms

@router.get("/rooms/{room_id}/messages", response_model=List[MessageSchema])
async def get_room_history(
    room_id: str, 
    limit: int = 50, 
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    room = await chat_repo.get_room_for_member(room_id, str(current_user["_id"]))
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    return await chat_repo.get_room_messages(room_id, limit, skip)

@router.post("/rooms/{room_id}/read")
async def mark_room_as_read(
    room_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a room as read for the current user."""
    success = await chat_repo.mark_room_as_read(room_id, str(current_user["_id"]))
    return {"success": success}

@router.post("/rooms/stand/{stand_id}", response_model=ChatRoomSchema)
async def initiate_chat_with_stand(
    stand_id: str,
    current_user: dict = Depends(get_current_user)
):
    from app.modules.stands.service import get_stand_by_id
    from app.modules.organizations.service import get_organization_by_id
    from app.modules.events.service import get_event_by_id

    # Accept Mongo ObjectId or UUID string IDs for stands
    stand = await get_stand_by_id(stand_id)
    if not stand:
        raise HTTPException(status_code=404, detail="Stand not found")

    # --- Fix H5: is_live check ---
    event_id = stand.get("event_id")
    event = await get_event_by_id(str(event_id)) if event_id else None
    if event and not timezone_service.is_event_live(event):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat is only available during the live event."
        )

    # Resolve to internal ID for consistency in other services
    resolved_stand_id = await resolve_stand_id(stand_id)
    org_id = stand.get("organization_id")
    org = await get_organization_by_id(org_id) if org_id else None
    if org:
        owner_id = org.get("owner_id")
    else:
        # Fallback: use event organizer as chat owner when organization doc is missing
        owner_id = event.get("organizer_id") if event else None
    if not owner_id:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Log lead interaction
    if current_user.get("role") == "visitor":
        try:
            await lead_service.log_interaction(LeadInteraction(
                visitor_id=str(current_user["_id"]),
                stand_id=resolved_stand_id,
                interaction_type="chat",
                metadata={"stand_name": stand.get("name")}
            ))
        except Exception:
            pass

    room = await chat_repo.get_or_create_direct_room(
        str(current_user["_id"]), owner_id,
        room_category="visitor",
        event_id=str(event_id) if event_id else None,
        stand_id=str(stand["_id"]),
    )

    # Best-effort analytics instrumentation.
    try:
        await log_event_persistent(
            type=AnalyticsEventType.CHAT_OPENED,
            user_id=str(current_user["_id"]),
            event_id=str(event_id) if event_id else None,
            stand_id=str(stand_id),
            metadata={
                "room_id": str(room.id) if room.id else None,
                "room_category": "visitor",
            },
        )
    except Exception:
        pass

    return room

@router.post("/rooms/b2b/{partner_org_id}", response_model=ChatRoomSchema)
async def initiate_b2b_chat(
    partner_org_id: str,
    event_id: str = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Start a B2B chat between current user (enterprise) and another organization owner.
    """
    from app.modules.organizations.service import get_organization_by_id
    from app.db.mongo import get_database

    if current_user.get("role") != "enterprise":
        raise HTTPException(status_code=403, detail="Only enterprise users can start B2B chats")
    if not event_id:
        raise HTTPException(status_code=400, detail="event_id is required for B2B chats")

    from bson import ObjectId as BSONObjectId
    db = get_database()
    # --- Fix 2: Resolve event_id to MongoDB _id if needed ---
    # Accepts event_id as slug, alias, or ObjectId
    event_doc = None
    try:
        event_doc = await db.events.find_one({"_id": BSONObjectId(event_id)})
    except Exception:
        pass
    if not event_doc:
        event_doc = await db.events.find_one({"slug": event_id})
    if not event_doc:
        event_doc = await db.events.find_one({"alias": event_id})
    if event_doc:
        event_id = str(event_doc["_id"])
        
    # --- Fix H5: is_live check ---
    if event_doc and not timezone_service.is_event_live(event_doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat is only available during the live event."
        )

    # --- Fix 1: owner_id is a string, not ObjectId ---
    org = await db.organizations.find_one({"owner_id": str(current_user["_id"])})
    if not org:
        raise HTTPException(status_code=403, detail="No organization found for your account")
    current_org_id = str(org["_id"])
    # Always pass resolved event_id (MongoDB _id) to get_user_participation
    current_participation = await get_user_participation(event_id, organization_id=current_org_id)
    import sys
    print(f"DEBUG B2B CHAT: event_id={event_id}, current_org_id={current_org_id}, participation={current_participation}", file=sys.stderr, flush=True)
    if not current_participation or current_participation.get("status") not in ("approved", "guest_approved"):
        raise HTTPException(status_code=403, detail="Your enterprise is not approved for this event")
    
    resolved_partner_org_id = await resolve_organization_id(partner_org_id)
    partner_org = await get_organization_by_id(resolved_partner_org_id)
    if not partner_org:
        raise HTTPException(status_code=404, detail="Partner organization not found")

    partner_participation = await get_user_participation(event_id, organization_id=resolved_partner_org_id)
    if not partner_participation or partner_participation.get("status") not in ("approved", "guest_approved"):
        raise HTTPException(status_code=403, detail="The partner enterprise is not approved for this event")
    
    owner_id = partner_org.get("owner_id")
    if not owner_id:
        raise HTTPException(status_code=404, detail="Organization owner not found")
    
    if owner_id == str(current_user["_id"]):
        raise HTTPException(status_code=400, detail="Cannot start a B2B chat with yourself")

    room = await chat_repo.get_or_create_direct_room(
        str(current_user["_id"]), owner_id,
        room_category="b2b", event_id=event_id,
    )

    # Best-effort analytics instrumentation.
    try:
        await log_event_persistent(
            type=AnalyticsEventType.CHAT_OPENED,
            user_id=str(current_user["_id"]),
            event_id=str(event_id),
            metadata={
                "room_id": str(room.id) if room.id else None,
                "room_category": "b2b",
                "partner_org_id": str(partner_org_id),
            },
        )
    except Exception:
        pass

    return room

@router.websocket("/ws/chat/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    room_id: str,
    token: str = Query(None),
):
    await websocket.accept()
    from app.core.security import decode_token
    
    user = None
    if token:
         payload = decode_token(token)
         if payload:
             from app.modules.users.service import get_user_by_id
             user = await get_user_by_id(payload.get("sub"))
    
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # --- Fix H6: is_active check ---
    if not user.get("is_active"):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Check room membership (accept ObjectId or string room ids and member ids)
    room = None
    user_id_str = str(user["_id"])
    user_id_obj = ObjectId(user_id_str) if ObjectId.is_valid(user_id_str) else None
    
    query_members = {"$in": [user_id_str, user_id_obj]} if user_id_obj else user_id_str
    
    if ObjectId.is_valid(room_id):
        room = await chat_repo.rooms.find_one({"_id": ObjectId(room_id), "members": query_members})
    if room is None:
        room = await chat_repo.rooms.find_one({"id": room_id, "members": query_members})
    
    if room is None:
        print(f"[WS] Access Denied: User {user_id_str} is not a member of room {room_id}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    manager.connect(user_id_str, websocket)
    print(f"[WS] Connected: User {user_id_str} to room {room_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Create Message
            new_msg = {
                "room_id": room_id,
                "sender_id": user_id_str,
                "sender_name": user.get('username') or user.get('full_name') or "Visitor",
                "content": message_data.get("content"),
                "type": message_data.get("type", "text"),
                "timestamp": datetime.now(timezone.utc)
            }
            
            # Save
            saved_msg = await chat_repo.create_message(new_msg)

            # Broadcast with JSON-safe payload (convert datetime/ObjectId)
            payload = jsonable_encoder(saved_msg, by_alias=True)
            await manager.broadcast_to_room(payload, room["members"])
            
    except WebSocketDisconnect:
        print(f"[WS] Disconnected: User {user_id_str}")
        manager.disconnect(user_id_str, websocket)
    except Exception as e:
        print(f"[WS] Error for User {user_id_str}: {e}")
        manager.disconnect(user_id_str, websocket)
