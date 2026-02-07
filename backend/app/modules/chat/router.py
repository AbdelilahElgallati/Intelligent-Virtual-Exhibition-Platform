from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from typing import List
from ...core.dependencies import get_current_user
from .schemas import MessageSchema, ChatRoomSchema, MessageCreate
from .repository import chat_repo
from .service import manager
from datetime import datetime

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

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    # In production, verify token here
    await manager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # 1. Process Message
            # 2. Save to DB
            # 3. Broadcast to Room Members
            
            # Simple Echo for now, we'll refine this
            await manager.send_personal_message(
                {"sender": "System", "content": f"Message received: {message_data['content']}"},
                client_id
            )
    except WebSocketDisconnect:
        manager.disconnect(client_id, websocket)
    except Exception:
        manager.disconnect(client_id, websocket)
