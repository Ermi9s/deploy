"""
Report service layer.

All business logic for the Report Generation module lives here.
Views import from this module and remain thin HTTP adapters.
"""
from __future__ import annotations

import io
import logging
import os

import requests as http_requests
from django.conf import settings
from django.db import transaction

from rag.celery import app as celery_app

from .models import ReportAgenda, ReportJob

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JWT / MAC helpers
# ---------------------------------------------------------------------------

def get_user_id(request) -> int:
    """Extract the integer user_id from the JWT payload."""
    return int(getattr(request.auth, "payload", {}).get("user_id", 0))


def get_mac(request) -> tuple[str | None, int | None]:
    """
    Extract Mandatory Access Control fields from the JWT payload.

    Returns (department_id, permission_ranking).
    Both may be None for users without a department assignment.
    """
    payload = getattr(request.auth, "payload", {})
    dept_id = payload.get("department_id")
    ranking = payload.get("permission_ranking")
    return dept_id, (int(ranking) if ranking is not None else None)


def get_bearer_token(request) -> str:
    """Extract the raw Bearer token string from the request."""
    return getattr(request.auth, "token", None) or (
        request.META.get("HTTP_AUTHORIZATION", "").replace("Bearer ", "")
    )


# ---------------------------------------------------------------------------
# Job creation
# ---------------------------------------------------------------------------

def create_report_job(
    *,
    user_id: int,
    title: str,
    agenda_texts: list[str],
    department_id: str | None,
    permission_ranking: int | None,
) -> ReportJob:
    """
    Create a ReportJob with its agenda items and enqueue the generation task.

    The Celery task receives the FULL payload — job metadata + agenda list —
    so the worker never has to query the database to read what it needs to
    process.  It only writes back results (status, sub_reports, final_report).

    The task is dispatched inside transaction.on_commit() to guarantee the
    rows are visible to the worker before it starts reading from PostgreSQL.
    """
    job = ReportJob.objects.create(
        user_id=user_id,
        title=title,
        status=ReportJob.STATUS_PENDING,
        department_id=department_id,
        permission_ranking=permission_ranking,
    )

    agendas = ReportAgenda.objects.bulk_create([
        ReportAgenda(job=job, order=i, text=text.strip())
        for i, text in enumerate(agenda_texts)
    ])
    # bulk_create returns the created instances with their PKs populated.

    # Build the self-contained payload so the worker needs zero DB reads.
    payload = {
        "job_id": str(job.id),
        "title": job.title,
        "department_id": department_id,
        "permission_ranking": permission_ranking,
        "top_k": int(os.getenv("REPORT_TOP_K_PER_AGENDA", "8")),
        "agendas": [
            {"id": str(a.id), "order": a.order, "text": a.text}
            for a in agendas
        ],
    }

    # Enqueue only after the transaction commits so the worker can safely
    # write back ORM updates without any read-before-insert race condition.
    transaction.on_commit(
        lambda: celery_app.send_task(
            "job_handlers.tasks.generate_report_task",
            kwargs={"payload": payload},
            queue="report_generation_jobs",
        )
    )

    logger.info(
        "ReportJob created job_id=%s user_id=%s agendas=%d",
        job.id, user_id, len(agenda_texts),
    )
    return job


# ---------------------------------------------------------------------------
# Job queries
# ---------------------------------------------------------------------------

def get_job_for_user(pk: str, user_id: int) -> ReportJob | None:
    """Fetch a single job owned by the given user, with agendas prefetched."""
    try:
        return ReportJob.objects.prefetch_related("agendas").get(
            id=pk, user_id=user_id
        )
    except ReportJob.DoesNotExist:
        return None


def list_jobs_for_user(user_id: int):
    """Return a queryset of all jobs for the given user."""
    return ReportJob.objects.filter(user_id=user_id).prefetch_related("agendas")


# ---------------------------------------------------------------------------
# Store-to-Drive
# ---------------------------------------------------------------------------

class DriveSyncError(Exception):
    """Raised when any step of the Drive upload pipeline fails."""

    def __init__(self, detail: str, step: str):
        super().__init__(detail)
        self.detail = detail
        self.step = step


def store_report_to_drive(job: ReportJob, request) -> str:
    """
    Upload the completed report to Drive and re-ingest it into Elasticsearch.

    Pipeline:
      1. POST to ingestion service → index into ES, get document_id + task_id
      2. POST to management service → request presigned MinIO upload URL
      3. PUT file bytes directly to MinIO
      4. POST to management service → confirm upload, get drive_item_id

    Returns the drive_item_id string on success.
    Raises DriveSyncError on any step failure.
    """
    access_token = get_bearer_token(request)
    management_base = os.getenv("MANAGEMENT_API_INTERNAL", "http://management:8000")
    ingestion_base = os.getenv("INGESTION_API_INTERNAL", "http://ingestion:8000")
    dept_id, perm_rank = get_mac(request)

    filename = f"{job.title[:80].replace('/', '-')}.md"
    file_content = job.final_report.encode("utf-8")
    dept_access = {dept_id: perm_rank} if dept_id and perm_rank is not None else {}

    # If the user has no specific department assigned via MAC, we must fall back
    # to the 'Public' department, otherwise the ingestion service throws 400.
    if not dept_access:
        try:
            dept_resp = http_requests.get(
                f"{management_base}/api/auth/departments/",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10
            )
            if dept_resp.status_code == 200:
                for d in dept_resp.json():
                    if d.get("name") == "Public":
                        dept_access = {d["uuid"]: 1}
                        break
        except Exception as exc:
            logger.error("Failed to fetch Public department for fallback: %s", exc)
        
        if not dept_access:
            # Fallback if management call fails or Public isn't found
            dept_access = {"Public": 1}

    # ── Step 1: Ingest into Elasticsearch ────────────────────────────────────
    try:
        ingest_resp = http_requests.post(
            f"{ingestion_base}/api/v1/documents/upload/",
            files={"file": (filename, io.BytesIO(file_content), "text/markdown")},
            data={"departmentAccess": str(dept_access).replace("'", '"')},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        ingest_resp.raise_for_status()
        ingest_data = ingest_resp.json()
        document_id = ingest_data.get("document_id")
        task_id = ingest_data.get("task_id")
    except Exception as exc:
        logger.error("Ingestion upload failed for job %s: %s", job.id, exc)
        raise DriveSyncError(
            "Failed to ingest report into knowledge base.", step="ingest"
        ) from exc

    # ── Step 2: Request presigned MinIO URL ───────────────────────────────────
    try:
        req_resp = http_requests.post(
            f"{management_base}/api/drive/upload/request/",
            json={
                "name": filename,
                "mimeType": "text/markdown",
                "size": len(file_content),
                "parentId": None,
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        req_resp.raise_for_status()
        req_data = req_resp.json()
        upload_url: str = req_data["uploadUrl"]
        storage_key: str = req_data["storageKey"]
    except Exception as exc:
        logger.error("Drive upload request failed for job %s: %s", job.id, exc)
        raise DriveSyncError(
            "Failed to request Drive upload URL.", step="upload_request"
        ) from exc

    # ── Step 3: PUT bytes to MinIO ────────────────────────────────────────────
    try:
        put_resp = http_requests.put(
            upload_url,
            data=file_content,
            headers={"Content-Type": "text/markdown"},
            timeout=30,
        )
        put_resp.raise_for_status()
    except Exception as exc:
        logger.error("MinIO PUT failed for job %s: %s", job.id, exc)
        raise DriveSyncError(
            "Failed to upload report to storage.", step="minio_put"
        ) from exc

    # ── Step 4: Confirm with management ──────────────────────────────────────
    try:
        confirm_resp = http_requests.post(
            f"{management_base}/api/drive/upload/confirm/",
            json={
                "storageKey": storage_key,
                "name": filename,
                "mimeType": "text/markdown",
                "parentId": None,
                "documentId": document_id,
                "taskId": task_id,
                "departmentAccess": dept_access,
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        confirm_resp.raise_for_status()
        drive_item = confirm_resp.json()
        drive_item_id: str = drive_item.get("id")
    except Exception as exc:
        logger.error("Drive confirm failed for job %s: %s", job.id, exc)
        raise DriveSyncError(
            "Failed to confirm Drive upload.", step="confirm"
        ) from exc

    # Persist the drive link
    job.drive_item_id = drive_item_id
    job.save(update_fields=["drive_item_id", "updated_at"])

    logger.info(
        "Report stored to Drive job_id=%s drive_item_id=%s", job.id, drive_item_id
    )
    return drive_item_id
