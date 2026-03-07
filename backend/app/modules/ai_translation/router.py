from fastapi import APIRouter, Depends, HTTPException
from .schemas import TranslationRequest, TranslationResponse, LanguageDetectionRequest, LanguageDetectionResponse
from .service import translation_service
from ...core.dependencies import get_current_user

router = APIRouter()

@router.post("/translate", response_model=TranslationResponse)
async def translate(
    request: TranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        return await translation_service.translate_text(
            request.text, 
            request.target_lang, 
            request.source_lang
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-language", response_model=LanguageDetectionResponse)
async def detect_language(
    request: LanguageDetectionRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        return await translation_service.detect_language(request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
