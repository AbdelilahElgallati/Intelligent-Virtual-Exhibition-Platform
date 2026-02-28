"""
Transcription Router - Whisper-Powered Speech-to-Text.
Provides endpoints for audio transcription with real-time streaming support.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, HTTPException
from fastapi import status as http_status
from typing import List, Dict, Optional
from pydantic import BaseModel
from ...core.dependencies import get_current_user
from .whisper_service import get_whisper_service
import json
import base64
import asyncio

router = APIRouter()


class TranscriptLine(BaseModel):
    """Model for a single transcript line."""
    id: str
    timestamp: str
    text: str
    speaker: Optional[str] = None


class TranscriptionRequest(BaseModel):
    """Request model for base64 audio transcription."""
    audio_chunk: str  # base64 encoded audio
    language: Optional[str] = None  # Auto-detect if not specified
    task: str = "transcribe"  # transcribe or translate


class TranscriptionResponse(BaseModel):
    """Response model for transcription results."""
    text: str
    language: str
    duration: float
    segments: List[dict]


class LanguageDetectionResponse(BaseModel):
    """Response model for language detection."""
    languages: Dict[str, float]


class ConnectionManager:
    """Manages WebSocket connections for live transcription."""
    
    def __init__(self):
        self.active_transcripts: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_transcripts:
            self.active_transcripts[room_id] = []
        self.active_transcripts[room_id].append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.active_transcripts:
            if websocket in self.active_transcripts[room_id]:
                self.active_transcripts[room_id].remove(websocket)
            if not self.active_transcripts[room_id]:
                del self.active_transcripts[room_id]

    async def broadcast_transcript(self, room_id: str, line: TranscriptLine):
        if room_id in self.active_transcripts:
            message = line.model_dump_json()
            for connection in self.active_transcripts[room_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass  # Handle disconnected clients gracefully


manager = ConnectionManager()


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    request: TranscriptionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Transcribe base64-encoded audio using Whisper.
    
    Supports:
    - Auto language detection
    - Translation to English (task="translate")
    """
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio_chunk)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")
    
    whisper_service = get_whisper_service()
    
    result = whisper_service.transcribe_bytes(
        audio_bytes=audio_bytes,
        language=request.language,
        task=request.task
    )
    
    return TranscriptionResponse(
        text=result["text"],
        language=result["language"],
        duration=result["duration"],
        segments=result["segments"]
    )


@router.post("/transcribe-file", response_model=TranscriptionResponse)
async def transcribe_file(
    file: UploadFile = File(...),
    language: Optional[str] = None,
    task: str = "transcribe",
    current_user: dict = Depends(get_current_user)
):
    """
    Transcribe an uploaded audio file.
    
    Supports common audio formats: wav, mp3, m4a, ogg, webm, etc.
    """
    # Read file content
    content = await file.read()
    
    # Get file extension
    extension = file.filename.split(".")[-1] if file.filename else "wav"
    
    whisper_service = get_whisper_service()
    
    result = whisper_service.transcribe_bytes(
        audio_bytes=content,
        file_extension=extension,
        language=language,
        task=task
    )
    
    return TranscriptionResponse(
        text=result["text"],
        language=result["language"],
        duration=result["duration"],
        segments=result["segments"]
    )


@router.post("/detect-language", response_model=LanguageDetectionResponse)
async def detect_language(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Detect the language of an audio file.
    Returns top 5 language probabilities.
    """
    content = await file.read()
    extension = file.filename.split(".")[-1] if file.filename else "wav"
    
    whisper_service = get_whisper_service()
    languages = whisper_service.detect_language(content, extension)
    
    return LanguageDetectionResponse(languages=languages)


@router.get("/languages")
async def get_supported_languages(
    current_user: dict = Depends(get_current_user)
):
    """Get list of supported languages for transcription."""
    whisper_service = get_whisper_service()
    return {"languages": whisper_service.get_available_languages()}


@router.websocket("/ws/live/{room_id}")
async def live_transcription_ws(websocket: WebSocket, room_id: str):
    """
    WebSocket endpoint for live transcription.

    When room_id matches a session_id in event_sessions, the session MUST be
    'live' — otherwise the connection is rejected with 1008 (policy violation).

    Clients can:
    1. Subscribe to receive transcripts (just connect)
    2. Send audio chunks for transcription

    Audio should be sent as base64-encoded chunks.
    """
    # Session-live guard: if room_id is a known session, require status == live
    try:
        from app.modules.sessions.service import get_session_by_id
        session_doc = await get_session_by_id(room_id)
        if session_doc is not None:
            if session_doc.get("status") != "live":
                await websocket.close(code=http_status.WS_1008_POLICY_VIOLATION)
                return
    except Exception:
        pass  # If lookup fails, allow connection (non-session rooms)

    await manager.connect(room_id, websocket)
    whisper_service = get_whisper_service()
    line_counter = 0
    
    try:
        while True:
            # Receive audio chunk
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                audio_b64 = message.get("audio")
                language = message.get("language")
                
                if audio_b64:
                    # Decode and transcribe
                    audio_bytes = base64.b64decode(audio_b64)
                    result = whisper_service.transcribe_bytes(
                        audio_bytes=audio_bytes,
                        language=language
                    )
                    
                    # Broadcast transcript
                    if result["text"].strip():
                        line_counter += 1
                        line = TranscriptLine(
                            id=f"{room_id}_{line_counter}",
                            timestamp=f"{result['duration']:.2f}s",
                            text=result["text"]
                        )
                        await manager.broadcast_transcript(room_id, line)
                        
                        # Also send to client
                        await websocket.send_json({
                            "type": "transcript",
                            "text": result["text"],
                            "language": result["language"]
                        })
            except json.JSONDecodeError:
                # Handle raw audio bytes (ping/pong)
                pass
            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
                
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
    except Exception:
        manager.disconnect(room_id, websocket)
