"""
RAG Assistant Router - Enhanced with Vector Search.
Provides endpoints for querying, document ingestion, and knowledge base management.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
from .schemas import QueryRequest, IngestRequest, SessionResponse
from .service import rag_service
from ...core.dependencies import get_current_user
import json

router = APIRouter()


class QueryWithSourcesRequest(BaseModel):
    """Request model for non-streaming query with sources."""
    query: str
    top_k: int = 3
    model: Optional[str] = None


class IngestTextRequest(BaseModel):
    """Request model for text ingestion."""
    content: str
    source: Optional[str] = None
    metadata: Optional[dict] = None


class StatsResponse(BaseModel):
    """Response model for vector store statistics."""
    name: str
    count: int


@router.post("/{scope}/query")
async def query_assistant(
    scope: str,
    request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Query the AI assistant with RAG retrieval.
    
    Returns a streaming SSE response with AI-generated text based on
    retrieved context from the vector store.
    """
    async def event_generator():
        async for chunk in rag_service.stream_query(
            query=request.query,
            scope=scope,
            use_retrieval=True
        ):
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/{scope}/query-with-sources")
async def query_with_sources(
    scope: str,
    request: QueryWithSourcesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Query the assistant and return full response with source attribution.
    Non-streaming endpoint for applications that need source references.
    """
    result = await rag_service.query_with_sources(
        query=request.query,
        scope=scope,
        top_k=request.top_k,
        model=request.model
    )
    return result


@router.post("/{scope}/ingest")
async def ingest_document(
    scope: str,
    request: IngestRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Ingest document content into the vector store.
    
    Supports:
    - Direct text content via 'content' field
    - URL fetching via 'source_url' field (future enhancement)
    
    Documents are chunked and embedded for semantic search.
    """
    if not request.content and not request.source_url:
        raise HTTPException(
            status_code=400,
            detail="Either 'content' or 'source_url' must be provided"
        )
    
    content = request.content or ""
    
    # TODO: If source_url provided, fetch content from URL
    if request.source_url and not request.content:
        raise HTTPException(
            status_code=501,
            detail="URL fetching not yet implemented. Please provide content directly."
        )
    
    result = await rag_service.ingest_document(
        content=content,
        scope=scope,
        source=request.source_url or "direct_input",
        **(request.metadata or {})
    )
    
    return result


@router.post("/{scope}/ingest-text")
async def ingest_text(
    scope: str,
    request: IngestTextRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Simple text ingestion endpoint.
    Ingests raw text content directly into the knowledge base.
    """
    result = await rag_service.ingest_document(
        content=request.content,
        scope=scope,
        source=request.source or "api_upload",
        **(request.metadata or {})
    )
    return result


@router.get("/{scope}/stats", response_model=StatsResponse)
async def get_scope_stats(
    scope: str,
    current_user: dict = Depends(get_current_user)
):
    """Get statistics for a scope's knowledge base."""
    stats = rag_service.get_stats(scope)
    return stats


@router.delete("/{scope}/documents")
async def delete_documents(
    scope: str,
    document_ids: List[str] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete specific documents from the knowledge base."""
    vector_store = rag_service.get_vector_store(scope)
    vector_store.delete(document_ids)
    return {"status": "deleted", "count": len(document_ids)}


@router.get("/session/{id}", response_model=SessionResponse)
async def get_session(id: str, current_user: dict = Depends(get_current_user)):
    """
    Retrieve chat session history.
    Sessions track conversation context for multi-turn interactions.
    """
    # TODO: Implement session storage in MongoDB
    return {
        "session_id": id,
        "messages": [],
        "created_at": "2024-01-01T00:00:00Z"
    }
