import asyncio
import logging
from config import get_settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    s = get_settings()
    return bool(s.r2_account_id and s.r2_access_key_id and s.r2_secret_access_key and s.r2_bucket)


def _client():
    import boto3
    from botocore.config import Config
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=f"https://{s.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=s.r2_access_key_id,
        aws_secret_access_key=s.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _upload_sync(key: str, data: bytes, content_type: str) -> str:
    s = get_settings()
    _client().put_object(Bucket=s.r2_bucket, Key=key, Body=data, ContentType=content_type)
    return f"{s.r2_public_url}/{key}"


def _exists_sync(key: str) -> bool:
    from botocore.exceptions import ClientError
    s = get_settings()
    try:
        _client().head_object(Bucket=s.r2_bucket, Key=key)
        return True
    except ClientError:
        return False


async def upload_bytes(key: str, data: bytes, content_type: str) -> str:
    """Upload bytes to R2 and return the public URL. Raises RuntimeError if not configured."""
    if not _is_configured():
        raise RuntimeError("R2 not configured")
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _upload_sync, key, data, content_type)


async def key_exists(key: str) -> bool:
    """Return True if the key exists in R2."""
    if not _is_configured():
        return False
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _exists_sync, key)


def public_url(key: str) -> str:
    return f"{get_settings().r2_public_url}/{key}"
