from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status
from typing import List
from ...core.dependencies import get_current_user, get_current_user_ws
from .schemas import MessageSchema, ChatRoomSchema, MessageCreate
from .repository import chat_repo
from .service import manager
from datetime import datetime
import json
from bson import ObjectId

router = APIRouter()

@router.get("/rooms", response_model=List[ChatRoomSchema])
async def get_my_rooms(current_user: dict = Depends(get_current_user)):
    return await chat_repo.get_user_rooms(current_user["_id"])

@router.get("/rooms/{room_id}/messages", response_model=List[MessageSchema])
async def get_room_history(
    room_id: str, 
    limit: int = 50, 
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    return await chat_repo.get_room_messages(room_id, limit, skip)

@router.post("/rooms/stand/{stand_id}", response_model=ChatRoomSchema)
async def initiate_chat_with_stand(
    stand_id: str,
    current_user: dict = Depends(get_current_user)
):
    from app.modules.stands.service import get_stand_by_id
    from app.modules.organizations.service import get_organization_by_id
    from uuid import UUID
    
    stand = await get_stand_by_id(UUID(stand_id))
    if not stand:
        raise HTTPException(status_code=404, detail="Stand not found")
        
    org = await get_organization_by_id(UUID(stand["organization_id"]))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    owner_id = org["owner_id"]
    
    # Optional: Prevent chatting with self
    if owner_id == str(current_user["_id"]):
         pass

    return await chat_repo.get_or_create_direct_room(str(current_user["_id"]), owner_id)

@router.websocket("/ws/chat/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    room_id: str,
    token: str = Query(None),
):
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

    # Check room membership
    room_messages = await chat_repo.get_room_messages(room_id, limit=1) # Just check if we can access? No, better check room doc.
    # For speed, let's assume if they have the room_id they might be allowed, 
    # BUT strictly we should check:
    room = await chat_repo.rooms.find_one({"_id": ObjectId(room_id), "members": str(user["_id"])})
    if not room:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(str(user["_id"]), websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Create Message
            new_msg = {
                "room_id": room_id,
                "sender_id": str(user["_id"]),
                "sender_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "content": message_data.get("content"),
                "type": message_data.get("type", "text"),
                "timestamp": datetime.utcnow()
            }
            
            # Save
            saved_msg = await chat_repo.create_message(new_msg)
            
            # Broadcast
            # We need room members to broadcast to. 
            await manager.broadcast_to_room(
                saved_msg.dict(by_alias=True), 
                room["members"]
            )
            
    except WebSocketDisconnect:
        manager.disconnect(str(user["_id"]), websocket)
    except Exception as e:
        print(f"WS Error: {e}")
        manager.disconnect(str(user["_id"]), websocket)
