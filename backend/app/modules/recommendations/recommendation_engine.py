"""
Hybrid Recommendation Engine.
Combines content-based and collaborative filtering for personalized recommendations.
"""
from typing import List, Dict, Any, Optional
from collections import defaultdict
import numpy as np
from .embedding_service import embedding_service, EmbeddingService
from .schemas import RecommendationItem


class ContentBasedFilter:
    """
    Content-based recommendation using item embeddings.
    Recommends items similar to user's previously interacted items.
    """
    
    def __init__(self, embedding_svc: EmbeddingService = None):
        self.embedding_svc = embedding_svc or embedding_service
    
    def recommend(
        self,
        user_history: List[Dict[str, Any]],
        candidate_items: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generate recommendations based on user's interaction history.
        
        Args:
            user_history: List of items user has interacted with
            candidate_items: Pool of items to recommend from
            top_k: Number of recommendations
            
        Returns:
            List of recommended items with scores
        """
        if not user_history or not candidate_items:
            return []
        
        # Create user profile from history embeddings
        history_embeddings = [
            self.embedding_svc.embed_item(item) for item in user_history
        ]
        user_profile = np.mean(history_embeddings, axis=0)
        
        # Compute candidate embeddings
        candidate_dict = {}
        for item in candidate_items:
            item_id = item.get("id", str(hash(item.get("title", ""))))
            embedding = self.embedding_svc.embed_item(item)
            candidate_dict[item_id] = {
                "embedding": embedding,
                "item": item
            }
        
        # Find similar items
        embeddings_only = {k: v["embedding"] for k, v in candidate_dict.items()}
        similar = self.embedding_svc.find_similar(user_profile, embeddings_only, top_k)
        
        # Add item details
        results = []
        for s in similar:
            item_data = candidate_dict[s["id"]]["item"]
            results.append({
                **item_data,
                "score": s["score"],
                "method": "content_based"
            })
        
        return results


class CollaborativeFilter:
    """
    Collaborative filtering using user-item interactions.
    Recommends items liked by similar users.
    """
    
    def __init__(self):
        # In-memory interaction matrix (for demo purposes)
        # In production, this would be stored in a database
        self.user_item_matrix: Dict[str, Dict[str, float]] = defaultdict(dict)
    
    def record_interaction(
        self,
        user_id: str,
        item_id: str,
        interaction_score: float = 1.0
    ):
        """Record a user-item interaction."""
        current = self.user_item_matrix[user_id].get(item_id, 0)
        self.user_item_matrix[user_id][item_id] = current + interaction_score
    
    def get_user_similarity(self, user1: str, user2: str) -> float:
        """Compute similarity between two users based on interactions."""
        items1 = set(self.user_item_matrix[user1].keys())
        items2 = set(self.user_item_matrix[user2].keys())
        
        if not items1 or not items2:
            return 0.0
        
        intersection = items1 & items2
        union = items1 | items2
        
        if not union:
            return 0.0
        
        return len(intersection) / len(union)  # Jaccard similarity
    
    def recommend(
        self,
        user_id: str,
        candidate_items: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generate recommendations based on similar users.
        
        Args:
            user_id: Target user ID
            candidate_items: Pool of items to recommend from
            top_k: Number of recommendations
            
        Returns:
            List of recommended items with scores
        """
        if user_id not in self.user_item_matrix:
            return []
        
        user_items = set(self.user_item_matrix[user_id].keys())
        
        # Find similar users
        user_similarities = {}
        for other_user in self.user_item_matrix:
            if other_user != user_id:
                sim = self.get_user_similarity(user_id, other_user)
                if sim > 0:
                    user_similarities[other_user] = sim
        
        # Aggregate item scores from similar users
        item_scores: Dict[str, float] = defaultdict(float)
        for other_user, sim in user_similarities.items():
            for item_id, score in self.user_item_matrix[other_user].items():
                if item_id not in user_items:  # Don't recommend already seen items
                    item_scores[item_id] += sim * score
        
        # Filter to candidate items and sort
        candidate_ids = {item.get("id") for item in candidate_items}
        filtered_scores = {k: v for k, v in item_scores.items() if k in candidate_ids}
        
        sorted_items = sorted(filtered_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        
        # Map back to item details
        item_lookup = {item.get("id"): item for item in candidate_items}
        results = []
        for item_id, score in sorted_items:
            if item_id in item_lookup:
                results.append({
                    **item_lookup[item_id],
                    "score": min(score, 1.0),  # Normalize
                    "method": "collaborative"
                })
        
        return results


class HybridRecommender:
    """
    Hybrid recommendation system combining multiple strategies.
    Weights content-based and collaborative signals for final ranking.
    """
    
    def __init__(
        self,
        content_weight: float = 0.6,
        collab_weight: float = 0.4
    ):
        """
        Initialize hybrid recommender.
        
        Args:
            content_weight: Weight for content-based recommendations
            collab_weight: Weight for collaborative recommendations
        """
        self.content_filter = ContentBasedFilter()
        self.collab_filter = CollaborativeFilter()
        self.content_weight = content_weight
        self.collab_weight = collab_weight
    
    def record_interaction(
        self,
        user_id: str,
        item_id: str,
        interaction_type: str = "view",
        metadata: Dict[str, Any] = None
    ):
        """
        Record a user interaction for collaborative filtering.
        
        Args:
            user_id: User identifier
            item_id: Item identifier
            interaction_type: Type of interaction (view, click, download, etc.)
            metadata: Additional interaction metadata
        """
        # Weight different interaction types
        weights = {
            "view": 1.0,
            "click": 2.0,
            "download": 3.0,
            "meeting": 5.0,
            "bookmark": 4.0
        }
        score = weights.get(interaction_type, 1.0)
        self.collab_filter.record_interaction(user_id, item_id, score)
    
    def recommend(
        self,
        user_id: str,
        user_history: List[Dict[str, Any]],
        candidate_items: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[RecommendationItem]:
        """
        Generate hybrid recommendations.
        
        Args:
            user_id: Target user ID
            user_history: User's interaction history (items with metadata)
            candidate_items: Available items to recommend
            top_k: Number of recommendations
            
        Returns:
            List of RecommendationItem objects
        """
        # Get content-based recommendations
        content_recs = self.content_filter.recommend(
            user_history, candidate_items, top_k * 2
        )
        
        # Get collaborative recommendations
        collab_recs = self.collab_filter.recommend(
            user_id, candidate_items, top_k * 2
        )
        
        # Merge and weight scores
        merged_scores: Dict[str, Dict[str, Any]] = {}
        
        for rec in content_recs:
            item_id = rec.get("id")
            merged_scores[item_id] = {
                "item": rec,
                "content_score": rec.get("score", 0),
                "collab_score": 0
            }
        
        for rec in collab_recs:
            item_id = rec.get("id")
            if item_id in merged_scores:
                merged_scores[item_id]["collab_score"] = rec.get("score", 0)
            else:
                merged_scores[item_id] = {
                    "item": rec,
                    "content_score": 0,
                    "collab_score": rec.get("score", 0)
                }
        
        # Compute final scores
        final_results = []
        for item_id, data in merged_scores.items():
            final_score = (
                self.content_weight * data["content_score"] +
                self.collab_weight * data["collab_score"]
            )
            item = data["item"]
            
            # Generate reason
            if data["content_score"] > data["collab_score"]:
                reason = "Similar to your interests"
            elif data["collab_score"] > 0:
                reason = "Popular among similar users"
            else:
                reason = "Recommended for you"
            
            final_results.append({
                "id": item_id,
                "title": item.get("title", "Unknown"),
                "type": item.get("type", "unknown"),
                "score": final_score,
                "reason": reason,
                "image_url": item.get("image_url")
            })
        
        # Sort and return top-k
        final_results.sort(key=lambda x: x["score"], reverse=True)
        
        return [
            RecommendationItem(**r)
            for r in final_results[:top_k]
        ]


# Singleton instance
hybrid_recommender = HybridRecommender()
