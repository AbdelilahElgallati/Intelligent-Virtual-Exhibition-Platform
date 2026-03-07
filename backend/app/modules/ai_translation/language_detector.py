"""
Language Detection Service using langdetect.
Fast and accurate source language identification.
"""
from typing import List, Tuple
from langdetect import detect, detect_langs, LangDetectException
from langdetect.lang_detect_exception import ErrorCode


# Supported language codes for the platform
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'fr': 'French',
    'ar': 'Arabic',
    'es': 'Spanish',
    'de': 'German',
    'zh-cn': 'Chinese (Simplified)',
    'ja': 'Japanese',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'it': 'Italian',
    'ru': 'Russian',
    'nl': 'Dutch',
    'tr': 'Turkish',
    'pl': 'Polish'
}


class LanguageDetector:
    """
    Fast language detection using Google's langdetect library.
    Based on n-gram probability profiles.
    """
    
    def __init__(self):
        self.supported_languages = SUPPORTED_LANGUAGES
    
    def detect(self, text: str) -> str:
        """
        Detect the primary language of text.
        
        Args:
            text: Input text to analyze
            
        Returns:
            ISO 639-1 language code
        """
        if not text or len(text.strip()) < 3:
            return "en"  # Default to English for short/empty text
        
        try:
            return detect(text)
        except LangDetectException:
            return "en"
    
    def detect_with_confidence(self, text: str) -> Tuple[str, float]:
        """
        Detect language with confidence score.
        
        Args:
            text: Input text to analyze
            
        Returns:
            Tuple of (language_code, confidence_score)
        """
        if not text or len(text.strip()) < 3:
            return ("en", 0.0)
        
        try:
            results = detect_langs(text)
            if results:
                best = results[0]
                return (best.lang, best.prob)
            return ("en", 0.0)
        except LangDetectException:
            return ("en", 0.0)
    
    def detect_multiple(self, text: str, top_k: int = 3) -> List[Tuple[str, float]]:
        """
        Get top-k language candidates with probabilities.
        
        Args:
            text: Input text to analyze
            top_k: Number of candidates to return
            
        Returns:
            List of (language_code, probability) tuples
        """
        if not text or len(text.strip()) < 3:
            return [("en", 0.0)]
        
        try:
            results = detect_langs(text)
            return [(r.lang, r.prob) for r in results[:top_k]]
        except LangDetectException:
            return [("en", 0.0)]
    
    def get_language_name(self, code: str) -> str:
        """Get human-readable language name from code."""
        return self.supported_languages.get(code, code.upper())
    
    def is_supported(self, code: str) -> bool:
        """Check if a language code is supported."""
        return code in self.supported_languages


# Singleton instance
language_detector = LanguageDetector()
