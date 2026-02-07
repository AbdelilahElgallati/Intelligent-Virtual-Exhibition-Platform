from pydantic import BaseModel
from typing import Optional, List

class TranslationRequest(BaseModel):
    text: str
    target_lang: str
    source_lang: Optional[str] = None

class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str

class LanguageDetectionRequest(BaseModel):
    text: str

class LanguageDetectionResponse(BaseModel):
    language: str
    confidence: float
