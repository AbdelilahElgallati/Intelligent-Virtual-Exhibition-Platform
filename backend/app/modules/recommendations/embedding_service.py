"""
Embedding Service for Recommendations.
Generates and manages embeddings for stands, events, and resources.
"""
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import numpy as np
from functools import lru_cache


class EmbeddingService:
    """
    Generates dense vector embeddings for content items.
    Used for content-based recommendation similarity matching.
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize embedding service.
        
        Args:
            model_name: HuggingFace model name for embeddings
        """
        self.model = SentenceTransformer(model_name)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        
        # Cache for pre-computed embeddings
        self._item_embeddings: Dict[str, np.ndarray] = {}
    
    def embed_text(self, text: str) -> np.ndarray:
        """Generate embedding for a single text."""
        return self.model.encode(text, convert_to_numpy=True)
    
    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for multiple texts (batch)."""
        return self.model.encode(texts, convert_to_numpy=True)
    
    def embed_item(self, item: Dict[str, Any]) -> np.ndarray:
        """
        Generate embedding for a content item (stand, event, resource).
        Combines title, description, and tags into a single embedding.
        
        Args:
            item: Dictionary with 'title', 'description', 'tags' fields
            
        Returns:
            Embedding vector
        """
        parts = []
        
        if item.get("title"):
            parts.append(item["title"])
        if item.get("description"):
            parts.append(item["description"])
        if item.get("tags"):
            parts.append(" ".join(item["tags"]))
        if item.get("category"):
            parts.append(f"Category: {item['category']}")
        
        text = " | ".join(parts) if parts else "unknown"
        return self.embed_text(text)
    
    def cache_item_embedding(self, item_id: str, embedding: np.ndarray):
        """Cache an item's embedding for fast lookup."""
        self._item_embeddings[item_id] = embedding
    
    def get_cached_embedding(self, item_id: str) -> Optional[np.ndarray]:
        """Retrieve a cached embedding."""
        return self._item_embeddings.get(item_id)
    
    def compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Compute cosine similarity between two embeddings.
        
        Returns:
            Similarity score between 0 and 1
        """
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))
    
    def find_similar(
        self,
        query_embedding: np.ndarray,
        candidate_embeddings: Dict[str, np.ndarray],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find most similar items to a query embedding.
        
        Args:
            query_embedding: Query vector
            candidate_embeddings: Dict of item_id -> embedding
            top_k: Number of results to return
            
        Returns:
            List of {id, score} dictionaries, sorted by similarity
        """
        if not candidate_embeddings:
            return []
        
        # Stack embeddings and compute similarities
        ids = list(candidate_embeddings.keys())
        embeddings = np.stack([candidate_embeddings[id] for id in ids])
        
        # Normalize
        query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-8)
        embeddings_norm = embeddings / (np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-8)
        
        # Cosine similarities
        similarities = np.dot(embeddings_norm, query_norm)
        
        # Sort and get top-k
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        return [
            {"id": ids[i], "score": float(similarities[i])}
            for i in top_indices
        ]


# Singleton instance
embedding_service = EmbeddingService()
