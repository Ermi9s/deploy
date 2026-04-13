import uuid
from io import BytesIO
from datetime import timedelta
from urllib.parse import urlparse
from minio import Minio
from minio.error import S3Error
from django.conf import settings

_client: Minio | None = None
_presign_client: Minio | None = None

def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
            region=settings.MINIO_REGION,
        )
    return _client


def get_presign_client() -> Minio:
    global _presign_client
    if _presign_client is None:
        endpoint = settings.MINIO_PUBLIC_ENDPOINT
        secure = settings.MINIO_PUBLIC_SECURE

        # Allow MINIO_PUBLIC_ENDPOINT to be provided as either host:port or full URL.
        if '://' in endpoint:
            parsed = urlparse(endpoint)
            endpoint = parsed.netloc or parsed.path
            if parsed.scheme:
                secure = parsed.scheme.lower() == 'https'

        _presign_client = Minio(
            endpoint,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=secure,
            region=settings.MINIO_REGION,
        )
    return _presign_client

def ensure_bucket() -> None:
    client = get_client()
    if not client.bucket_exists(settings.MINIO_BUCKET):
        client.make_bucket(settings.MINIO_BUCKET)

def generate_upload_key(owner_id, filename: str) -> str:
    return f"uploads/{owner_id}/{uuid.uuid4()}/{filename}"

def presigned_put_url(object_key: str, expires_minutes: int = 10) -> str:
    return get_presign_client().presigned_put_object(
        settings.MINIO_BUCKET, object_key,
        expires=timedelta(minutes=expires_minutes),
    )

def presigned_get_url(object_key: str, expires_minutes: int = 60) -> str:
    return get_presign_client().presigned_get_object(
        settings.MINIO_BUCKET, object_key,
        expires=timedelta(minutes=expires_minutes),
    )

def object_exists(object_key: str) -> bool:
    try:
        get_client().stat_object(settings.MINIO_BUCKET, object_key)
        return True
    except S3Error:
        return False

def get_object_size(object_key: str) -> int:
    stat = get_client().stat_object(settings.MINIO_BUCKET, object_key)
    return stat.size


def get_object_bytes(object_key: str) -> bytes:
    response = get_client().get_object(settings.MINIO_BUCKET, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def put_object_bytes(object_key: str, content: bytes, content_type: str = 'application/octet-stream') -> None:
    stream = BytesIO(content)
    get_client().put_object(
        settings.MINIO_BUCKET,
        object_key,
        stream,
        length=len(content),
        content_type=content_type,
    )
