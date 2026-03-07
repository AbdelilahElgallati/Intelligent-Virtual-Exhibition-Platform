"""
Text Chunker for document preprocessing.
Splits long documents into smaller chunks for better retrieval.
"""
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter


class DocumentChunker:
    """
    Splits documents into semantically meaningful chunks.
    Uses recursive character splitting with overlap for context preservation.
    """
    
    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        separators: List[str] = None
    ):
        """
        Initialize the chunker.
        
        Args:
            chunk_size: Target size of each chunk in characters
            chunk_overlap: Number of overlapping characters between chunks
            separators: Custom separators for splitting (default: paragraphs, sentences, words)
        """
        if separators is None:
            separators = ["\n\n", "\n", ". ", " ", ""]
        
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=separators,
            length_function=len
        )
    
    def chunk_text(self, text: str) -> List[str]:
        """Split a single text into chunks."""
        return self.splitter.split_text(text)
    
    def chunk_document(
        self,
        text: str,
        metadata: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Split a document and attach metadata to each chunk.
        
        Args:
            text: The document text to split
            metadata: Base metadata to attach to all chunks
        
        Returns:
            List of chunk dictionaries with text and metadata
        """
        if metadata is None:
            metadata = {}
        
        chunks = self.chunk_text(text)
        
        return [
            {
                "text": chunk,
                "metadata": {
                    **metadata,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
            }
            for i, chunk in enumerate(chunks)
        ]


# Default chunker instance
default_chunker = DocumentChunker()


def chunk_for_ingestion(
    content: str,
    source: str = None,
    scope: str = None,
    **extra_metadata
) -> List[Dict[str, Any]]:
    """
    Convenience function to chunk content for vector store ingestion.
    
    Args:
        content: The text content to chunk
        source: Source identifier (URL, filename, etc.)
        scope: Scope identifier (platform, event_id, stand_id)
        **extra_metadata: Additional metadata fields
    
    Returns:
        List of chunks ready for vector store ingestion
    """
    metadata = {
        "source": source or "unknown",
        "scope": scope or "platform",
        **extra_metadata
    }
    
    return default_chunker.chunk_document(content, metadata)
