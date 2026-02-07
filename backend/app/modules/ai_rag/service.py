"""
Enhanced RAG Service with Vector Search and Semantic Retrieval.
Combines sentence-transformers embeddings, ChromaDB vector store, and LLM generation.
"""
import httpx
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
from ...core.config import settings
from .vector_store import get_vector_store
from .chunker import chunk_for_ingestion


class RAGService:
    """
    Retrieval-Augmented Generation service.
    Uses semantic search to retrieve relevant context before LLM generation.
    """
    
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        self.default_model = "llama3"
    
    def get_vector_store(self, scope: str = "platform"):
        """Get the vector store for a specific scope."""
        return get_vector_store(scope)
    
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
        model: str = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a response to a query with optional RAG retrieval.
        
        Args:
            query: User query
            scope: Scope for context retrieval
            use_retrieval: Whether to retrieve context from vector store
            model: LLM model to use (default: llama3)
        
        Yields:
            Response tokens as they're generated
        """
        # Retrieve context if enabled
        context = ""
        if use_retrieval:
            context = await self.retrieve_context(query, scope=scope)
        
        # Build prompt
        if context:
            prompt = f"""You are a helpful AI assistant for a virtual exhibition platform.
Use the following context to answer the user's question. If the context doesn't contain
relevant information, say so and answer based on your general knowledge.

Context:
{context}

User Question: {query}

Answer:"""
        else:
            prompt = f"""You are a helpful AI assistant for a virtual exhibition platform.
Answer the user's question helpfully and concisely.

User Question: {query}

Answer:"""
        
        # Stream from Ollama
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                self.ollama_url,
                json={
                    "model": model or self.default_model,
                    "prompt": prompt,
                    "stream": True
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            yield data.get("response", "")
                            if data.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
    
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
        
        context = "\n\n".join([r["document"] for r in results])
        sources = [
            {
                "source": r.get("metadata", {}).get("source", "Unknown"),
                "relevance": 1 - r.get("distance", 0)  # Convert distance to similarity
            }
            for r in results
        ]
        
        # Generate response
        response_text = ""
        async for chunk in self.stream_query(query, scope=scope, model=model):
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
