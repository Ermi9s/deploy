#!/usr/bin/env python
import os
import sys
from minio import Minio
from minio.error import S3Error

def main():
    # Read variables directly from the container environment
    endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY") or os.getenv("MINIO_ROOT_USER")
    secret_key = os.getenv("MINIO_SECRET_KEY") or os.getenv("MINIO_ROOT_PASSWORD")
    bucket_name = os.getenv("MINIO_BUCKET", "mybucket")
    secure = os.getenv("MINIO_SECURE", "False").lower() in ("true", "1", "t")

    if not access_key or not secret_key:
        print("Error: MinIO credentials missing from environment variables.", file=sys.stderr)
        sys.exit(1)

    # Strip URL schemes if accidentially passed into the endpoint
    if "://" in endpoint:
        endpoint = endpoint.split("://")[-1]

    print(f"Connecting to MinIO at {endpoint}...")
    client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure
    )

    try:
        if not client.bucket_exists(bucket_name):
            print(f"Bucket '{bucket_name}' does not exist. Creating it...")
            client.make_bucket(bucket_name)
            print(f"Bucket '{bucket_name}' successfully created!")
        else:
            print(f"Bucket '{bucket_name}' already exists.")
    except S3Error as e:
        print(f"MinIO Client Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Failed to connect or initialize bucket: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()