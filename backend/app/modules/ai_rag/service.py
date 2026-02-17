"""
Enhanced RAG Service with Vector Search and Semantic Retrieval.
This implementation does NOT call external LLMs; it answers directly from retrieved context
or returns an explicit "I don't know" when no context is available.
"""
import json
import re
from typing import AsyncGenerator, List, Dict, Any, Optional
from app.db.mongo import get_database
from .vector_store import get_vector_store
from .chunker import chunk_for_ingestion


class RAGService:
    """
    Retrieval-Augmented Generation service.
    Uses semantic search to retrieve relevant context before LLM generation.
    """
    
    def get_vector_store(self, scope: str = "platform"):
        """Get the vector store for a specific scope."""
        return get_vector_store(scope)

    async def _retrieve_db_facts(self, query: str, scope: str, top_k: int = 5) -> List[str]:
        """Lightweight DB lookup to surface factual data when present."""
        db = get_database()
        terms = [t for t in re.findall(r"[A-Za-z0-9]+", query) if len(t) > 2]
        pattern = "|".join(terms) if terms else re.escape(query)
        regex = {"$regex": pattern, "$options": "i"}
        facts: List[str] = []

        # Scope-aware searches
        if scope.startswith("stand-"):
            stand_id = scope.replace("stand-", "")
            stand_query = [{"id": stand_id}]
            from bson import ObjectId
            if ObjectId.is_valid(stand_id):
                stand_query.append({"_id": ObjectId(stand_id)})
            stand = await db.stands.find_one({"$or": stand_query})
            if stand:
                facts.append(f"Stand: {stand.get('name', 'Unknown')} (type: {stand.get('stand_type', 'standard')})")
            # Resources for this stand
            cursor = db.resources.find({"stand_id": stand_id}).limit(top_k)
            async for res in cursor:
                facts.append(f"Resource: {res.get('title', 'Untitled')} [{res.get('type', 'file')}] at {res.get('file_path', '')}")

        elif scope.startswith("event-"):
            event_id = scope.replace("event-", "")
            event_query = [{"id": event_id}]
            from bson import ObjectId
            if ObjectId.is_valid(event_id):
                event_query.append({"_id": ObjectId(event_id)})
            event = await db.events.find_one({"$or": event_query})
            if event:
                facts.append(f"Event: {event.get('title', 'Unknown')} (state: {event.get('state', '')}, dates: {event.get('start_date', '')} - {event.get('end_date', '')})")
            cursor = db.stands.find({"event_id": event_id}).limit(top_k)
            async for stand in cursor:
                facts.append(f"Stand: {stand.get('name', 'Unknown')} (org {stand.get('organization_id', '')})")

        else:
            # Platform-wide quick search on events/stands names (partial match)
            cursor = db.events.find({"title": regex}).limit(top_k)
            async for ev in cursor:
                facts.append(f"Event: {ev.get('title', 'Unknown')} (state: {ev.get('state', '')})")
            cursor = db.stands.find({"name": regex}).limit(top_k)
            async for st in cursor:
                facts.append(f"Stand: {st.get('name', 'Unknown')} (event {st.get('event_id', '')})")

        return facts
    
    async def ingest_document(
        self,
        content: str,
        scope: str = "platform",
        source: str = None,
        **metadata
    ) -> Dict[str, Any]:
        """
        Ingest a document into the vector store.
        
        Args:
            content: Document text content
            scope: Scope for the document (platform, event_id, stand_id)
            source: Source identifier (URL, filename)
            **metadata: Additional metadata
        
        Returns:
            Ingestion result with chunk count and IDs
        """
        # Chunk the document
        chunks = chunk_for_ingestion(content, source=source, scope=scope, **metadata)
        
        # Get vector store for scope
        vector_store = self.get_vector_store(scope)
        
        # Extract texts and metadata
        texts = [chunk["text"] for chunk in chunks]
        metadatas = [chunk["metadata"] for chunk in chunks]
        
        # Add to vector store
        ids = vector_store.add_documents(documents=texts, metadatas=metadatas)
        
        return {
            "status": "success",
            "scope": scope,
            "source": source,
            "chunks_created": len(ids),
            "chunk_ids": ids
        }
    
    async def retrieve_context(
        self,
        query: str,
        scope: str = "platform",
        top_k: int = 3
    ) -> str:
        """
        Retrieve relevant context for a query using semantic search.
        
        Args:
            query: User query
            scope: Scope to search in
            top_k: Number of chunks to retrieve
        
        Returns:
            Concatenated context string
        """
        vector_store = self.get_vector_store(scope)
        results = vector_store.search(query, top_k=top_k)
        
        if not results:
            return ""
        
        # Format context with source attribution
        context_parts = []
        for i, result in enumerate(results, 1):
            source = result.get("metadata", {}).get("source", "Unknown")
            context_parts.append(f"[Source {i}: {source}]\n{result['document']}")
        
        return "\n\n---\n\n".join(context_parts)
    
    async def stream_query(
        self,
        query: str,
        scope: str = "platform",
        use_retrieval: bool = True,
        model: str = None,
        top_k: int = 3,
    ) -> AsyncGenerator[str, None]:
        """
        Stream a response using only retrieved context (no external LLM calls).
        If no context is found, respond with an explicit fallback.
        """
        context_blocks: List[str] = []

        if use_retrieval:
            vector_store = self.get_vector_store(scope)
            results = vector_store.search(query, top_k=top_k)
            for i, result in enumerate(results, 1):
                source = result.get("metadata", {}).get("source", "Unknown")
                context_blocks.append(f"[Vector {i}: {source}]\n{result['document']}")

        # Add structured DB facts
        db_facts = await self._retrieve_db_facts(query, scope, top_k=top_k)
        for i, fact in enumerate(db_facts, 1):
            context_blocks.append(f"[DB {i}] {fact}")

        if not context_blocks:
            yield "I don't have access to that information right now."
            return

        answer = "\n\n".join(context_blocks)
        yield answer
    
    async def query_with_sources(
        self,
        query: str,
        scope: str = "platform",
        top_k: int = 3,
        model: str = None
    ) -> Dict[str, Any]:
        """
        Non-streaming query that returns full response with source attribution.
        
        Args:
            query: User query
            scope: Scope for retrieval
            top_k: Number of sources to retrieve
            model: LLM model to use
        
        Returns:
            Response with answer and sources
        """
        # Get context and sources
        vector_store = self.get_vector_store(scope)
        results = vector_store.search(query, top_k=top_k)

        sources = [
            {
                "source": r.get("metadata", {}).get("source", "Unknown"),
                "relevance": 1 - r.get("distance", 0)
            }
            for r in results
        ]

        response_text = ""
        async for chunk in self.stream_query(query, scope=scope, top_k=top_k):
            response_text += chunk

        return {
            "answer": response_text,
            "sources": sources,
            "scope": scope
        }
    
    def get_stats(self, scope: str = "platform") -> Dict[str, Any]:
        """Get statistics for a scope's vector store."""
        vector_store = self.get_vector_store(scope)
        return vector_store.get_collection_stats()


# Singleton instance
rag_service = RAGService()
