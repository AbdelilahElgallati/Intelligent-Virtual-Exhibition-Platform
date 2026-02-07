"""
Whisper Transcription Service.
Uses OpenAI Whisper for accurate speech-to-text transcription.
"""
from typing import Optional, Dict, Any, List
import whisper
import numpy as np
import tempfile
import os
from io import BytesIO


class WhisperService:
    """
    Speech-to-text service using OpenAI Whisper.
    Supports multiple model sizes for speed/accuracy tradeoff.
    """
    
    # Available models: tiny, base, small, medium, large
    AVAILABLE_MODELS = ["tiny", "base", "small", "medium", "large"]
    
    def __init__(self, model_size: str = "base"):
        """
        Initialize Whisper service.
        
        Args:
            model_size: Whisper model size (tiny, base, small, medium, large)
                - tiny: Fastest, lowest accuracy (~1GB VRAM)
                - base: Good balance (~1GB VRAM)
                - small: Better accuracy (~2GB VRAM)
                - medium: High accuracy (~5GB VRAM)
                - large: Best accuracy (~10GB VRAM)
        """
        if model_size not in self.AVAILABLE_MODELS:
            model_size = "base"
        
        self.model_size = model_size
        self._model = None
    
    @property
    def model(self):
        """Lazy load the Whisper model."""
        if self._model is None:
            print(f"Loading Whisper model: {self.model_size}")
            self._model = whisper.load_model(self.model_size)
        return self._model
    
    def transcribe_file(
        self,
        file_path: str,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> Dict[str, Any]:
        """
        Transcribe an audio file.
        
        Args:
            file_path: Path to audio file
            language: Source language code (auto-detect if None)
            task: "transcribe" or "translate" (to English)
            
        Returns:
            Transcription result with text and segments
        """
        options = {
            "task": task,
            "verbose": False
        }
        
        if language:
            options["language"] = language
        
        result = self.model.transcribe(file_path, **options)
        
        return {
            "text": result["text"].strip(),
            "language": result.get("language", "unknown"),
            "segments": [
                {
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"].strip()
                }
                for seg in result.get("segments", [])
            ],
            "duration": result.get("segments", [{}])[-1].get("end", 0) if result.get("segments") else 0
        }
    
    def transcribe_bytes(
        self,
        audio_bytes: bytes,
        file_extension: str = "wav",
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> Dict[str, Any]:
        """
        Transcribe audio from bytes.
        
        Args:
            audio_bytes: Raw audio data
            file_extension: Audio format extension
            language: Source language code
            task: "transcribe" or "translate"
            
        Returns:
            Transcription result
        """
        # Write to temp file (Whisper requires file path)
        with tempfile.NamedTemporaryFile(suffix=f".{file_extension}", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name
        
        try:
            result = self.transcribe_file(temp_path, language, task)
        finally:
            os.unlink(temp_path)
        
        return result
    
    def transcribe_chunk(
        self,
        audio_chunk: np.ndarray,
        sample_rate: int = 16000,
        language: Optional[str] = None
    ) -> str:
        """
        Transcribe a numpy audio chunk (for streaming).
        
        Args:
            audio_chunk: Audio samples as numpy array
            sample_rate: Audio sample rate (Whisper expects 16kHz)
            language: Source language code
            
        Returns:
            Transcribed text
        """
        # Resample if needed
        if sample_rate != 16000:
            # Simple linear interpolation resampling
            duration = len(audio_chunk) / sample_rate
            new_length = int(duration * 16000)
            audio_chunk = np.interp(
                np.linspace(0, len(audio_chunk), new_length),
                np.arange(len(audio_chunk)),
                audio_chunk
            ).astype(np.float32)
        
        # Ensure float32 in [-1, 1] range
        if audio_chunk.dtype != np.float32:
            audio_chunk = audio_chunk.astype(np.float32)
        if np.max(np.abs(audio_chunk)) > 1.0:
            audio_chunk = audio_chunk / 32768.0  # Normalize from int16
        
        # Pad/truncate to 30 seconds
        audio_chunk = whisper.pad_or_trim(audio_chunk)
        
        # Create mel spectrogram
        mel = whisper.log_mel_spectrogram(audio_chunk).to(self.model.device)
        
        # Detect language if not specified
        if not language:
            _, probs = self.model.detect_language(mel)
            language = max(probs, key=probs.get)
        
        # Decode
        options = whisper.DecodingOptions(
            language=language,
            without_timestamps=True
        )
        result = whisper.decode(self.model, mel, options)
        
        return result.text.strip()
    
    def detect_language(self, audio_bytes: bytes, file_extension: str = "wav") -> Dict[str, float]:
        """
        Detect the language of audio content.
        
        Args:
            audio_bytes: Raw audio data
            file_extension: Audio format
            
        Returns:
            Dictionary of language codes and probabilities
        """
        with tempfile.NamedTemporaryFile(suffix=f".{file_extension}", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name
        
        try:
            audio = whisper.load_audio(temp_path)
            audio = whisper.pad_or_trim(audio)
            mel = whisper.log_mel_spectrogram(audio).to(self.model.device)
            _, probs = self.model.detect_language(mel)
            
            # Return top 5 languages
            sorted_langs = sorted(probs.items(), key=lambda x: x[1], reverse=True)[:5]
            return dict(sorted_langs)
        finally:
            os.unlink(temp_path)
    
    def get_available_languages(self) -> List[str]:
        """Get list of supported languages."""
        return list(whisper.tokenizer.LANGUAGES.keys())


# Singleton instance (lazy loaded)
_whisper_service: Optional[WhisperService] = None


def get_whisper_service(model_size: str = "base") -> WhisperService:
    """Get or create the Whisper service singleton."""
    global _whisper_service
    if _whisper_service is None:
        _whisper_service = WhisperService(model_size)
    return _whisper_service
