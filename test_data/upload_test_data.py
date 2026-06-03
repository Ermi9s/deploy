#!/usr/bin/env python3
"""
OKM Platform Test Data Upload Automation Script
This script logs in as department heads, resolves department database UUIDs,
and uploads all test files under test_data/ to the OKM platform.

Upload flow:
1. Ingestion service: POST file + departmentAccess metadata
2. Generate storage key locally (same scheme as management service)
3. Upload binary directly to MinIO using the minio-py SDK (avoids presigned URL host issues)
4. Management service: POST confirm to register the drive item
"""

import io
import os
import sys
import json
import uuid
import argparse
import mimetypes
from pathlib import Path
import requests

try:
    from minio import Minio
    from minio.error import S3Error
except ImportError:
    print("[-] Fatal: 'minio' package not found. Install it with: pip install minio")
    sys.exit(1)

# Mapping of test directory names to department name and head user credentials
DEPT_CONFIGS = {
    "engineering": {
        "dept_name": "Engineering",
        "email": "alice.chen@apexsolutions.com",
        "password": "Test@1234!"
    },
    "finance": {
        "dept_name": "Finance",
        "email": "george.mbeki@apexsolutions.com",
        "password": "Test@1234!"
    },
    "human_resources": {
        "dept_name": "Human Resources",
        "email": "diana.osei@apexsolutions.com",
        "password": "Test@1234!"
    },
    "legal": {
        "dept_name": "Legal & Compliance",
        "email": "julia.santos@apexsolutions.com",
        "password": "Test@1234!"
    },
    "operations": {
        "dept_name": "Operations",
        "email": "laura.mensah@apexsolutions.com",
        "password": "Test@1234!"
    }
}

# Clearance ranking names to integer levels
CLEARANCE_RANKS = {
    "public": 1,
    "confidential": 2,
    "secret": 3
}

def login_user(email, password, base_url):
    """Obtain JWT access token for a user."""
    url = f"{base_url}/auth/token/"
    try:
        r = requests.post(url, json={"email": email, "password": password}, timeout=10)
        if r.status_code == 200:
            return r.json().get("access")
        else:
            print(f"[-] Login failed for {email}: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        print(f"[-] Exception during login for {email}: {e}")
        return None

def get_departments(token, base_url):
    """Retrieve all departments and map their names to database UUIDs."""
    url = f"{base_url}/auth/departments/"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            return {d["name"]: d["uuid"] for d in r.json()}
        else:
            print(f"[-] Failed to fetch departments: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        print(f"[-] Exception fetching departments: {e}")
        return None

def upload_file(file_path, dept_name, rank, dept_uuid_map, user_token,
                ingestion_url, management_url,
                minio_endpoint, minio_access_key, minio_secret_key,
                minio_bucket, minio_secure, owner_id):
    """Execute the upload handshake for a single file."""
    filename = file_path.name
    filesize = file_path.stat().st_size
    mime_type, _ = mimetypes.guess_type(filename)
    if not mime_type:
        mime_type = "text/plain"

    public_dept_uuid = dept_uuid_map.get("Public")
    target_dept_uuid = dept_uuid_map.get(dept_name)

    if not target_dept_uuid:
        print(f"[-] [{filename}] Error: Target department '{dept_name}' UUID not resolved.")
        return False

    dept_access = {
        public_dept_uuid: 1,
        target_dept_uuid: rank
    }

    print(f"\n[*] [{filename}] Starting ingestion workflow...")
    print(f"    - Type: {mime_type} | Size: {filesize} bytes")
    print(f"    - Access Matrix: {json.dumps(dept_access)}")

    # Step 1: Upload metadata and payload to Ingestion Service
    print(f"    [Step 1/3] Ingesting file metadata...")
    ingestion_endpoint = f"{ingestion_url}/api/v1/documents/upload/"
    try:
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, mime_type)}
            data = {"departmentAccess": json.dumps(dept_access)}
            r = requests.post(ingestion_endpoint, files=files, data=data, timeout=30)
            if r.status_code not in (200, 201, 202):
                print(f"    [-] Step 1 Failed: {r.status_code} - {r.text}")
                return False
            resp_data = r.json()
            document_id = resp_data.get("document_id")
            task_id = resp_data.get("task_id")
            print(f"    [+] Ingest accepted. Doc ID: {document_id} | Task ID: {task_id}")
    except Exception as e:
        print(f"    [-] Step 1 Exception: {e}")
        return False

    # Step 2: Upload file directly to MinIO via SDK (avoids presigned URL host-signature issues)
    storage_key = f"uploads/{owner_id}/{uuid.uuid4()}/{filename}"
    print(f"    [Step 2/3] Uploading directly to MinIO ({minio_endpoint})...")
    try:
        minio_client = Minio(
            minio_endpoint,
            access_key=minio_access_key,
            secret_key=minio_secret_key,
            secure=minio_secure,
        )
        file_data = file_path.read_bytes()
        minio_client.put_object(
            minio_bucket,
            storage_key,
            io.BytesIO(file_data),
            length=len(file_data),
            content_type=mime_type,
        )
        print(f"    [+] Payload uploaded. Storage key: {storage_key}")
    except Exception as e:
        print(f"    [-] Step 2 Exception: {e}")
        return False

    # Step 3: Confirm Upload with Management Service
    print(f"    [Step 3/3] Confirming upload transaction...")
    mgmt_confirm_endpoint = f"{management_url}/api/drive/upload/confirm/"
    headers = {"Authorization": f"Bearer {user_token}"}
    payload_confirm = {
        "storageKey": storage_key,
        "checksum": "",
        "documentId": document_id,
        "taskId": task_id,
        "departmentAccess": dept_access,
        "name": filename,
        "mimeType": mime_type,
        "parentId": None
    }

    try:
        r = requests.post(mgmt_confirm_endpoint, json=payload_confirm, headers=headers, timeout=10)
        if r.status_code not in (200, 201):
            print(f"    [-] Step 3 Failed: {r.status_code} - {r.text}")
            return False
        print(f"    [+] Upload confirmed! File registered on Drive.")
        return True
    except Exception as e:
        print(f"    [-] Step 3 Exception: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Upload OKM Test Data")
    parser.add_argument("--ingestion-url", default="http://localhost:8001", help="Ingestion service base URL")
    parser.add_argument("--management-url", default="http://localhost:8002", help="Management service base URL")
    parser.add_argument("--minio-endpoint", default="localhost:9000", help="MinIO host:port (no scheme)")
    parser.add_argument("--minio-access-key", default="okm_minio_user", help="MinIO access key")
    parser.add_argument("--minio-secret-key", default="okm_minio_password", help="MinIO secret key")
    parser.add_argument("--minio-bucket", default="okm-files", help="MinIO bucket name")
    parser.add_argument("--minio-secure", action="store_true", help="Use HTTPS for MinIO")
    parser.add_argument("--admin-email", default="admin@apexsolutions.com", help="System administrator email")
    parser.add_argument("--admin-password", default="Admin@1234!", help="System administrator password")
    parser.add_argument("--user-password", default="Test@1234!", help="Default password for department head accounts")
    args = parser.parse_args()

    # Locate test data directories
    script_dir = Path(__file__).resolve().parent
    test_data_dir = script_dir
    print(f"[+] Scanning for test data in: {test_data_dir}")
    print(f"[+] MinIO endpoint: {args.minio_endpoint} | Bucket: {args.minio_bucket}")

    # Authenticate as admin to retrieve department maps
    print(f"[+] Logging in as admin '{args.admin_email}'...")
    admin_token = login_user(args.admin_email, args.admin_password, args.management_url)
    if not admin_token:
        print("[-] Fatal: Failed to obtain admin access token. Exiting.")
        sys.exit(1)

    print("[+] Fetching department definitions...")
    dept_uuid_map = get_departments(admin_token, args.management_url)
    if not dept_uuid_map:
        print("[-] Fatal: Failed to retrieve department list. Exiting.")
        sys.exit(1)

    print(f"[+] Found {len(dept_uuid_map)} departments in system.")
    for dept_name_k, dept_uuid_v in dept_uuid_map.items():
        print(f"    - {dept_name_k}: {dept_uuid_v}")

    if "Public" not in dept_uuid_map:
        print("[-] Fatal: 'Public' department not found in DB. Make sure signals/seeding ran successfully. Exiting.")
        sys.exit(1)

    # Pre-authenticate all department head users
    user_tokens = {}
    print("\n[+] Pre-authenticating department heads...")
    for dir_name, config in DEPT_CONFIGS.items():
        email = config["email"]
        password = args.user_password or config["password"]
        print(f"    - Logging in as {email}...")
        token = login_user(email, password, args.management_url)
        if not token:
            print(f"[-] Fatal: Failed to log in as department user {email}. Exiting.")
            sys.exit(1)
        user_tokens[dir_name] = token

    # Execute uploads
    success_count = 0
    fail_count = 0
    total_files = 0

    print("\n[+] Beginning batch upload process...")
    for dir_name, config in DEPT_CONFIGS.items():
        dept_name = config["dept_name"]
        user_token = user_tokens[dir_name]
        dept_dir = test_data_dir / dir_name

        if not dept_dir.exists():
            print(f"[-] Warning: Department directory {dept_dir} does not exist. Skipping.")
            continue

        for lvl_name, rank in CLEARANCE_RANKS.items():
            lvl_dir = dept_dir / lvl_name
            if not lvl_dir.exists():
                continue

            for file_path in lvl_dir.iterdir():
                if not file_path.is_file() or file_path.name.startswith("."):
                    continue

                total_files += 1

                # Resolve the user's DB ID from their token payload for storage key generation
                import base64 as _b64
                token_payload = user_token.split(".")[1]
                token_payload += "=" * (4 - len(token_payload) % 4)  # fix padding
                owner_id = json.loads(_b64.b64decode(token_payload)).get("user_id", "0")

                success = upload_file(
                    file_path=file_path,
                    dept_name=dept_name,
                    rank=rank,
                    dept_uuid_map=dept_uuid_map,
                    user_token=user_token,
                    ingestion_url=args.ingestion_url,
                    management_url=args.management_url,
                    minio_endpoint=args.minio_endpoint,
                    minio_access_key=args.minio_access_key,
                    minio_secret_key=args.minio_secret_key,
                    minio_bucket=args.minio_bucket,
                    minio_secure=args.minio_secure,
                    owner_id=owner_id,
                )
                if success:
                    success_count += 1
                else:
                    fail_count += 1

    print("\n" + "=" * 50)
    print(" ingestion upload session summary".upper())
    print("=" * 50)
    print(f"  Total Files Found:  {total_files}")
    print(f"  Successfully Seeded: {success_count}")
    print(f"  Failed Uploads:      {fail_count}")
    print("=" * 50)

    if fail_count > 0:
        print("[-] Upload session completed with errors.")
        sys.exit(1)
    else:
        print("[+] All files ingested successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()
