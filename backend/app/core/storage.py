"""
Object storage helper for uploads.
Uploads to Cloudflare R2 when configured; otherwise falls back to local disk.
"""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse
from typing import TypedDict

import boto3
from fastapi import UploadFile

from .config import settings

logger = logging.getLogger(__name__)


class StoredUpload(TypedDict):
    url: str
    size: int
    content_type: str
    key: str
    provider: str


def r2_is_configured() -> bool:
    return bool(
        settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
        and settings.R2_ENDPOINT
    )


def _r2_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _build_r2_public_url(key: str) -> str:
    base = (settings.R2_PUBLIC_BASE_URL or "").strip().rstrip("/")
    if base:
        return f"{base}/{key}"

    # Fallback URL format (works if bucket is publicly readable).
    endpoint = settings.R2_ENDPOINT.rstrip("/")
    return f"{endpoint}/{settings.R2_BUCKET_NAME}/{key}"


def _extract_r2_key_from_url(url: str) -> str | None:
    normalized = (url or "").strip()
    if not normalized:
        return None

    public_base = (settings.R2_PUBLIC_BASE_URL or "").strip().rstrip("/")
    if public_base and normalized.startswith(f"{public_base}/"):
        return normalized[len(public_base) + 1 :]

    endpoint = (settings.R2_ENDPOINT or "").strip().rstrip("/")
    bucket = (settings.R2_BUCKET_NAME or "").strip().strip("/")
    fallback_prefix = f"{endpoint}/{bucket}/" if endpoint and bucket else ""
    if fallback_prefix and normalized.startswith(fallback_prefix):
        return normalized[len(fallback_prefix) :]

    return None


def _extract_local_upload_path(url: str) -> Path | None:
    normalized = (url or "").strip()
    if not normalized:
        return None

    parsed = urlparse(normalized)
    path = parsed.path if parsed.scheme else normalized

    if not path.startswith("/uploads/"):
        return None

    relative_path = path.lstrip("/")
    backend_root = Path(__file__).resolve().parents[2]
    candidate = (backend_root / relative_path).resolve()
    uploads_root = (backend_root / "uploads").resolve()

    if uploads_root in candidate.parents and candidate.is_file():
        return candidate
    return None


def delete_managed_upload_by_url(url: str | None) -> bool:
    """
    Delete a managed upload (R2 or local /uploads path) by its stored URL.
    Returns True when a delete operation is attempted successfully.
    """
    if not url:
        return False

    key = _extract_r2_key_from_url(url)
    if key and r2_is_configured():
        try:
            client = _r2_client()
            client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
            return True
        except Exception as exc:
            logger.warning("Failed to delete R2 object '%s': %s", key, exc)
            return False

    local_path = _extract_local_upload_path(url)
    if local_path:
        try:
            local_path.unlink(missing_ok=True)
            return True
        except Exception as exc:
            logger.warning("Failed to delete local upload '%s': %s", local_path, exc)

    return False


async def store_upload(
    *,
    file: UploadFile,
    local_dir: str,
    local_url_prefix: str,
    r2_folder: str,
    filename_prefix: str,
) -> StoredUpload:
    """
    Persist uploaded file to R2 when available; fallback to local uploads.
    """
    ext = os.path.splitext(file.filename or "file")[1] or ".bin"
    safe_name = f"{filename_prefix}_{uuid.uuid4().hex}{ext}"
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    file_size = len(content)

    normalized_r2_folder = r2_folder.strip("/").replace("\\", "/")
    r2_key = f"{normalized_r2_folder}/{safe_name}" if normalized_r2_folder else safe_name

    if r2_is_configured():
        try:
            client = _r2_client()
            client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=r2_key,
                Body=content,
                ContentType=content_type,
            )
            return {
                "url": _build_r2_public_url(r2_key),
                "size": file_size,
                "content_type": content_type,
                "key": r2_key,
                "provider": "r2",
            }
        except Exception as exc:
            logger.error("R2 upload failed for %s. Falling back to local storage. Error: %s", r2_key, str(exc))

    # Local storage fallback
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, safe_name)
    with open(local_path, "wb") as output:
        output.write(content)

    # Ensure local URL is clean
    final_url = f"{local_url_prefix.rstrip('/')}/{safe_name}"
    
    return {
        "url": final_url,
        "size": file_size,
        "content_type": content_type,
        "key": safe_name,
        "provider": "local",
    }
