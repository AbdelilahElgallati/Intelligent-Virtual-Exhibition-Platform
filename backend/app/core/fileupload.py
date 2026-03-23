"""
Secure file upload utilities for IVEP backend.
Validates file uploads before saving to prevent security issues.
"""

import logging
import mimetypes
from typing import Tuple
from fastapi import HTTPException, status, UploadFile

logger = logging.getLogger(__name__)

# Allowed MIME types per upload category
ALLOWED_UPLOADS = {
    "images": {
        "mimetypes": ["image/jpeg", "image/png", "image/webp"],
        "extensions": [".jpg", ".jpeg", ".png", ".webp"],
        "max_size_mb": 10,
    },
    "documents": {
        "mimetypes": ["application/pdf"],
        "extensions": [".pdf"],
        "max_size_mb": 50,
    },
    "resources": {
        "mimetypes": ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        "extensions": [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
        "max_size_mb": 50,
    },
}

# Magic bytes for file type verification
MAGIC_BYTES = {
    b'\xff\xd8\xff': "image/jpeg",      # JPEG
    b'\x89PNG\r\n': "image/png",        # PNG
    b'RIFF': "image/webp",              # WEBP (contains "WEBP" at offset 8)
    b'%PDF': "application/pdf",         # PDF
}


def get_file_mime_type(filename: str) -> str:
    """Get MIME type from filename."""
    mime_type = mimetypes.guess_type(filename)[0]
    return mime_type or "application/octet-stream"


async def verify_file_magic_bytes(file: UploadFile) -> str:
    """
    Verify file by checking magic bytes (file signature).
    
    Args:
        file: UploadFile object
    
    Returns:
        Detected MIME type
    
    Raises:
        HTTPException if file type invalid
    """
    # Read first 12 bytes to check magic
    content = await file.read(12)
    await file.seek(0)  # Reset file pointer
    
    detected_type = None
    
    # Check JPEG
    if content.startswith(b'\xff\xd8\xff'):
        detected_type = "image/jpeg"
    # Check PNG
    elif content.startswith(b'\x89PNG\r\n'):
        detected_type = "image/png"
    # Check PDF
    elif content.startswith(b'%PDF'):
        detected_type = "application/pdf"
    # Check WEBP
    elif content.startswith(b'RIFF') and b'WEBP' in content:
        detected_type = "image/webp"
    
    return detected_type or file.content_type or "application/octet-stream"


async def validate_file_upload(
    file: UploadFile,
    category: str = "images",
) -> Tuple[bool, str]:
    """
    Comprehensive validation for uploaded files.
    
    Args:
        file: UploadFile from FastAPI
        category: Upload category (images, documents, resources)
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Raises:
        HTTPException if validation fails
    """
    
    if category not in ALLOWED_UPLOADS:
        raise ValueError(f"Unknown upload category: {category}")
    
    rules = ALLOWED_UPLOADS[category]
    
    # 1. Check filename
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a valid filename"
        )
    
    # 2. Check file extension
    filename_lower = file.filename.lower()
    file_ext = None
    for ext in rules["extensions"]:
        if filename_lower.endswith(ext):
            file_ext = ext
            break
    
    if not file_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed for {category}. Allowed: {', '.join(rules['extensions'])}"
        )
    
    # 3. Check file size
    if file.size and file.size > rules["max_size_mb"] * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {rules['max_size_mb']}MB limit"
        )
    
    # 4. Verify magic bytes (actual file type)
    detected_type = await verify_file_magic_bytes(file)
    if detected_type not in rules["mimetypes"]:
        logger.warning(f"File type mismatch for {file.filename}: claimed={file.content_type}, detected={detected_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File content does not match declared type. Detected: {detected_type}"
        )
    
    # 5. Sanitize filename (remove path traversal attempts)
    safe_filename = file.filename
    if "/" in safe_filename or "\\" in safe_filename:
        # Extract just the filename without path
        safe_filename = safe_filename.split("/")[-1].split("\\")[-1]
    
    return True, safe_filename


async def secure_save_file(
    file: UploadFile,
    save_dir: str,
    category: str = "images",
) -> str:
    """
    Securely save uploaded file after validation.
    
    Args:
        file: UploadFile from FastAPI
        save_dir: Directory to save file
        category: Upload category
    
    Returns:
        Relative file path saved
    
    Raises:
        HTTPException if validation fails
    """
    import os
    import uuid
    
    # Validate file
    is_valid, safe_filename = await validate_file_upload(file, category)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File validation failed"
        )
    
    # Generate unique filename to prevent collision/overwrite attacks
    name_parts = safe_filename.rsplit(".", 1)
    unique_filename = f"{name_parts[0]}_{uuid.uuid4().hex[:8]}.{name_parts[1]}"
    
    # Create directory if not exists
    os.makedirs(save_dir, exist_ok=True)
    
    filepath = os.path.join(save_dir, unique_filename)
    
    try:
        # Read and save file with size check
        content = await file.read()
        max_bytes = ALLOWED_UPLOADS[category]["max_size_mb"] * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File content exceeds {ALLOWED_UPLOADS[category]['max_size_mb']}MB"
            )
        
        with open(filepath, "wb") as f:
            f.write(content)
        
        logger.info(f"✓ File saved: {unique_filename}")
        return unique_filename
    
    except Exception as e:
        logger.error(f"✗ File save failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File upload failed"
        )
