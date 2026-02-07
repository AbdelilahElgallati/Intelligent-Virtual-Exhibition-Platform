"""
Vector Store Service using ChromaDB for semantic search.
Handles document storage, embedding generation, and similarity retrieval.
"""
from typing import List, Optional, Dict, Any
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import uuid
import os

# Persist directory for ChromaDB
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "chroma_db")
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)


class VectorStore:
    """
    ChromaDB-backed vector store for semantic document retrieval.
    Uses sentence-transformers for embedding generation.
    """
    
    def __init__(self, collection_name: str = "ivep_documents"):
        self.collection_name = collection_name
        
        # Initialize embedding model (lightweight, fast, multilingual-capable)
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize ChromaDB with persistence
        self.client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}  # Use cosine similarity
        )
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for a single text."""
        return self.embedding_model.encode(text, convert_to_numpy=True).tolist()
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (batch processing)."""
        return self.embedding_model.encode(texts, convert_to_numpy=True).tolist()
    
    def add_documents(
        self,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None
    ) -> List[str]:
        """
        Add documents to the vector store.
        
        Args:
            documents: List of text content to store
            metadatas: Optional metadata for each document
            ids: Optional custom IDs (auto-generated if not provided)
        
        Returns:
            List of document IDs
        """
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in documents]
        
        if metadatas is None:
            metadatas = [{} for _ in documents]
        
        # Generate embeddings
        embeddings = self.generate_embeddings(documents)
        
        # Add to ChromaDB
        self.collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
        
        return ids
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents using semantic similarity.
        
        Args:
            query: Search query text
            top_k: Number of results to return
            filter_metadata: Optional metadata filter
        
        Returns:
            List of results with document, metadata, and similarity score
        """
        query_embedding = self.generate_embedding(query)
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=filter_metadata
        )
        
        # Format results
        formatted_results = []
        if results['documents'] and results['documents'][0]:
            for i, doc in enumerate(results['documents'][0]):
                formatted_results.append({
                    "id": results['ids'][0][i] if results['ids'] else None,
                    "document": doc,
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "distance": results['distances'][0][i] if results['distances'] else None
                })
        
        return formatted_results
    
    def delete(self, ids: List[str]) -> None:
        """Delete documents by their IDs."""
        self.collection.delete(ids=ids)
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the collection."""
        return {
            "name": self.collection_name,
            "count": self.collection.count()
        }


# Singleton instances for different scopes
_vector_stores: Dict[str, VectorStore] = {}


def get_vector_store(scope: str = "platform") -> VectorStore:
    """
    Get or create a VectorStore for a specific scope.
    
    Args:
        scope: The scope identifier (e.g., 'platform', 'event_123', 'stand_456')
    
    Returns:
        VectorStore instance for the scope
    """
    if scope not in _vector_stores:
        collection_name = f"ivep_{scope}"
        _vector_stores[scope] = VectorStore(collection_name=collection_name)
    
    return _vector_stores[scope]
