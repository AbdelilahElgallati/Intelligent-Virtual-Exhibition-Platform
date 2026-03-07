"""
Enhanced Translation Service using dedicated ML models.
Combines MarianMT for translation and langdetect for language detection.
"""
from typing import Optional
from .language_detector import language_detector, LanguageDetector
from .translation_model import get_translator, MarianTranslator
from .schemas import TranslationResponse, LanguageDetectionResponse


class TranslationService:
    """
    High-level translation service combining detection and translation.
    Uses dedicated HuggingFace models instead of LLM prompting.
    """
    
    def __init__(self):
        self.detector: LanguageDetector = language_detector
        self._translator: Optional[MarianTranslator] = None
    
    @property
    def translator(self) -> MarianTranslator:
        """Lazy-load translator to avoid startup delay."""
        if self._translator is None:
            self._translator = get_translator()
        return self._translator
    
    async def detect_language(self, text: str) -> LanguageDetectionResponse:
        """
        Detect the language of input text.
        
        Args:
            text: Input text to analyze
            
        Returns:
            LanguageDetectionResponse with language code and confidence
        """
        lang, confidence = self.detector.detect_with_confidence(text)
        return LanguageDetectionResponse(
            language=lang,
            confidence=confidence
        )
    
    async def translate_text(
        self,
        text: str,
        target_lang: str,
        source_lang: Optional[str] = None
    ) -> TranslationResponse:
        """
        Translate text to target language.
        
        Args:
            text: Text to translate
            target_lang: Target language code (e.g., 'en', 'fr', 'ar')
            source_lang: Optional source language (auto-detected if not provided)
            
        Returns:
            TranslationResponse with original and translated text
        """
        # Auto-detect source language if not provided
        if not source_lang:
            detection = await self.detect_language(text)
            source_lang = detection.language
        
        # Skip translation if same language
        if source_lang.lower() == target_lang.lower():
            return TranslationResponse(
                original_text=text,
                translated_text=text,
                source_lang=source_lang,
                target_lang=target_lang
            )
        
        # Check if pair is supported
        if not self.translator.is_pair_supported(source_lang, target_lang):
            # Fall back to original text with warning
            return TranslationResponse(
                original_text=text,
                translated_text=text,
                source_lang=source_lang,
                target_lang=target_lang
            )
        
        # Perform translation
        translated_text = self.translator.translate(
            text=text,
            source_lang=source_lang,
            target_lang=target_lang
        )
        
        return TranslationResponse(
            original_text=text,
            translated_text=translated_text,
            source_lang=source_lang,
            target_lang=target_lang
        )
    
    def get_supported_languages(self) -> dict:
        """Get dictionary of supported language codes and names."""
        return self.detector.supported_languages
    
    def get_supported_pairs(self) -> list:
        """Get list of directly supported translation pairs."""
        return self.translator.get_supported_pairs()


# Singleton instance
translation_service = TranslationService()
