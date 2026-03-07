"""
MarianMT Translation Model Service.
Uses HuggingFace Helsinki-NLP/opus-mt models for high-quality translation.
"""
from typing import Dict, Optional, List
from transformers import MarianMTModel, MarianTokenizer
import torch
from functools import lru_cache


# Map of supported language pairs to model names
# Format: (source, target) -> model_name
MODEL_REGISTRY = {
    # English <-> French
    ('en', 'fr'): 'Helsinki-NLP/opus-mt-en-fr',
    ('fr', 'en'): 'Helsinki-NLP/opus-mt-fr-en',
    # English <-> Arabic
    ('en', 'ar'): 'Helsinki-NLP/opus-mt-en-ar',
    ('ar', 'en'): 'Helsinki-NLP/opus-mt-ar-en',
    # English <-> Spanish
    ('en', 'es'): 'Helsinki-NLP/opus-mt-en-es',
    ('es', 'en'): 'Helsinki-NLP/opus-mt-es-en',
    # English <-> German
    ('en', 'de'): 'Helsinki-NLP/opus-mt-en-de',
    ('de', 'en'): 'Helsinki-NLP/opus-mt-de-en',
    # English <-> Chinese
    ('en', 'zh'): 'Helsinki-NLP/opus-mt-en-zh',
    ('zh', 'en'): 'Helsinki-NLP/opus-mt-zh-en',
    # English <-> Russian
    ('en', 'ru'): 'Helsinki-NLP/opus-mt-en-ru',
    ('ru', 'en'): 'Helsinki-NLP/opus-mt-ru-en',
    # English <-> Portuguese
    ('en', 'pt'): 'Helsinki-NLP/opus-mt-en-pt',
    ('pt', 'en'): 'Helsinki-NLP/opus-mt-pt-en',
    # English <-> Italian
    ('en', 'it'): 'Helsinki-NLP/opus-mt-en-it',
    ('it', 'en'): 'Helsinki-NLP/opus-mt-it-en',
    # English <-> Dutch
    ('en', 'nl'): 'Helsinki-NLP/opus-mt-en-nl',
    ('nl', 'en'): 'Helsinki-NLP/opus-mt-nl-en',
    # English <-> Turkish
    ('en', 'tr'): 'Helsinki-NLP/opus-mt-en-tr',
    ('tr', 'en'): 'Helsinki-NLP/opus-mt-tr-en',
    # French <-> Arabic
    ('fr', 'ar'): 'Helsinki-NLP/opus-mt-fr-ar',
    ('ar', 'fr'): 'Helsinki-NLP/opus-mt-ar-fr',
    # Multilingual fallback (many-to-many)
    ('mul', 'en'): 'Helsinki-NLP/opus-mt-mul-en',
}


class MarianTranslator:
    """
    Translation service using MarianMT models.
    Automatically selects the appropriate model based on language pair.
    """
    
    def __init__(self, device: str = None):
        """
        Initialize the translator.
        
        Args:
            device: Device to use ('cuda', 'cpu', or None for auto-detect)
        """
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        
        self._models: Dict[str, MarianMTModel] = {}
        self._tokenizers: Dict[str, MarianTokenizer] = {}
    
    def _get_model_name(self, source_lang: str, target_lang: str) -> Optional[str]:
        """Get the model name for a language pair."""
        # Normalize language codes
        source = source_lang.lower().split('-')[0]
        target = target_lang.lower().split('-')[0]
        
        # Direct match
        if (source, target) in MODEL_REGISTRY:
            return MODEL_REGISTRY[(source, target)]
        
        # Try pivot through English
        if source != 'en' and target != 'en':
            if (source, 'en') in MODEL_REGISTRY and ('en', target) in MODEL_REGISTRY:
                return None  # Will handle via pivot
        
        # Multilingual fallback to English
        if target == 'en' and ('mul', 'en') in MODEL_REGISTRY:
            return MODEL_REGISTRY[('mul', 'en')]
        
        return None
    
    def _load_model(self, model_name: str) -> tuple:
        """Load and cache a model and tokenizer."""
        if model_name not in self._models:
            print(f"Loading translation model: {model_name}")
            tokenizer = MarianTokenizer.from_pretrained(model_name)
            model = MarianMTModel.from_pretrained(model_name)
            model.to(self.device)
            model.eval()
            
            self._tokenizers[model_name] = tokenizer
            self._models[model_name] = model
        
        return self._models[model_name], self._tokenizers[model_name]
    
    def translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        max_length: int = 512
    ) -> str:
        """
        Translate text from source to target language.
        
        Args:
            text: Text to translate
            source_lang: Source language code
            target_lang: Target language code
            max_length: Maximum output length
            
        Returns:
            Translated text
        """
        # Same language - no translation needed
        if source_lang.lower() == target_lang.lower():
            return text
        
        model_name = self._get_model_name(source_lang, target_lang)
        
        if model_name is None:
            # Try pivot translation through English
            return self._pivot_translate(text, source_lang, target_lang, max_length)
        
        model, tokenizer = self._load_model(model_name)
        
        # Tokenize and translate
        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=max_length)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            translated = model.generate(**inputs, max_length=max_length)
        
        result = tokenizer.decode(translated[0], skip_special_tokens=True)
        return result
    
    def _pivot_translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        max_length: int
    ) -> str:
        """Translate via English as pivot language."""
        # Source -> English
        english_text = self.translate(text, source_lang, 'en', max_length)
        # English -> Target
        final_text = self.translate(english_text, 'en', target_lang, max_length)
        return final_text
    
    def translate_batch(
        self,
        texts: List[str],
        source_lang: str,
        target_lang: str,
        max_length: int = 512
    ) -> List[str]:
        """
        Translate multiple texts in batch.
        
        Args:
            texts: List of texts to translate
            source_lang: Source language code
            target_lang: Target language code
            max_length: Maximum output length per text
            
        Returns:
            List of translated texts
        """
        if source_lang.lower() == target_lang.lower():
            return texts
        
        model_name = self._get_model_name(source_lang, target_lang)
        
        if model_name is None:
            # Fall back to individual translations with pivot
            return [self._pivot_translate(t, source_lang, target_lang, max_length) for t in texts]
        
        model, tokenizer = self._load_model(model_name)
        
        inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=max_length)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            translated = model.generate(**inputs, max_length=max_length)
        
        results = [tokenizer.decode(t, skip_special_tokens=True) for t in translated]
        return results
    
    def get_supported_pairs(self) -> List[tuple]:
        """Get list of directly supported language pairs."""
        return list(MODEL_REGISTRY.keys())
    
    def is_pair_supported(self, source_lang: str, target_lang: str) -> bool:
        """Check if a language pair is supported (directly or via pivot)."""
        source = source_lang.lower().split('-')[0]
        target = target_lang.lower().split('-')[0]
        
        # Direct support
        if (source, target) in MODEL_REGISTRY:
            return True
        
        # Pivot support (both to/from English exist)
        if source != 'en' and target != 'en':
            has_source_to_en = (source, 'en') in MODEL_REGISTRY or ('mul', 'en') in MODEL_REGISTRY
            has_en_to_target = ('en', target) in MODEL_REGISTRY
            return has_source_to_en and has_en_to_target
        
        return False


# Singleton instance (lazy loaded)
_translator: Optional[MarianTranslator] = None


def get_translator() -> MarianTranslator:
    """Get or create the translator singleton."""
    global _translator
    if _translator is None:
        _translator = MarianTranslator()
    return _translator
