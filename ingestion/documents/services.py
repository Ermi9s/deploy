from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from celery import Celery
from celery.result import AsyncResult
from django.conf import settings

from .models import UploadedDocument


def get_celery_app() -> Celery:
    app = Celery('ingestion-producer')
    app.conf.broker_url = settings.CELERY_BROKER_URL
    app.conf.result_backend = settings.CELERY_RESULT_BACKEND
    app.conf.task_serializer = 'json'
    app.conf.result_serializer = 'json'
    app.conf.accept_content = ['json']
    return app


def enqueue_document(document: UploadedDocument) -> str:
    payload = {
        'document_id': str(document.id),
        'file_path': document.storage_path,
        'mime_type': document.mime_type,
        'original_filename': document.original_filename,
        # MAC: forward the permission matrix to the worker so it can embed
        # it in every Elasticsearch chunk for downstream RAG filtering.
        'department_access': document.department_access,
    }
    task = get_celery_app().send_task(settings.WORKERS_INGEST_TASK_NAME, kwargs={'payload': payload}, queue="default")
    return task.id


def get_task_progress(task_id: str | None) -> dict[str, Any]:
    if not task_id:
        return {'status': UploadedDocument.Status.QUEUED, 'progress': 0, 'stage': 'queued', 'message': 'Queued'}

    result = AsyncResult(task_id, app=get_celery_app())
    state = (result.state or 'PENDING').upper()
    info = result.info if isinstance(result.info, dict) else {}

    if state == 'SUCCESS':
        final = result.result if isinstance(result.result, dict) else {}
        return {
            'status': UploadedDocument.Status.COMPLETED,
            'progress': 100,
            'stage': final.get('stage', 'completed'),
            'message': final.get('message', 'Completed'),
            'result': final,
        }

    if state == 'FAILURE':
        return {
            'status': UploadedDocument.Status.FAILED,
            'progress': int(info.get('progress', 100) if info else 100),
            'stage': info.get('stage', 'failed'),
            'message': str(result.result),
        }

    if state in {'PROGRESS', 'STARTED', 'RETRY'}:
        return {
            'status': UploadedDocument.Status.PROCESSING,
            'progress': int(info.get('progress', 0)),
            'stage': info.get('stage', state.lower()),
            'message': info.get('message', 'Processing'),
        }

    return {
        'status': UploadedDocument.Status.QUEUED,
        'progress': 0,
        'stage': 'queued',
        'message': 'Queued',
    }


def sync_document_status(document: UploadedDocument) -> dict[str, Any]:
    # Auto-heal documents that were corrupted by the old Redis expiration bug.
    # If a document is 'queued' but has a completed_at timestamp, we restore its status.
    if document.status == UploadedDocument.Status.QUEUED and document.completed_at is not None:
        restored_status = UploadedDocument.Status.FAILED if document.error_message else UploadedDocument.Status.COMPLETED
        document.status = restored_status
        document.progress = 100
        document.stage = 'completed' if restored_status == UploadedDocument.Status.COMPLETED else 'failed'
        document.save(update_fields=['status', 'progress', 'stage', 'updated_at'])

    # Prevent reverting terminal states if Celery drops the result from Redis over time.
    if document.status in {UploadedDocument.Status.COMPLETED, UploadedDocument.Status.FAILED}:
        return {
            'status': document.status,
            'progress': document.progress,
            'stage': document.stage,
            'message': 'Completed' if document.status == UploadedDocument.Status.COMPLETED else document.error_message,
        }

    progress_data = get_task_progress(document.task_id)
    status = progress_data['status']

    updates = {
        'status': status,
        'progress': progress_data['progress'],
        'stage': progress_data['stage'],
    }

    if status == UploadedDocument.Status.PROCESSING and document.started_at is None:
        updates['started_at'] = datetime.now(timezone.utc)

    if status in {UploadedDocument.Status.COMPLETED, UploadedDocument.Status.FAILED} and document.completed_at is None:
        updates['completed_at'] = datetime.now(timezone.utc)

    if status == UploadedDocument.Status.FAILED:
        updates['error_message'] = progress_data.get('message', '')

    for field, value in updates.items():
        setattr(document, field, value)

    document.save(update_fields=[*updates.keys(), 'updated_at'])
    return progress_data


def save_upload(uploaded_file, target_dir: str | Path, filename: str) -> Path:
    target_path = Path(target_dir)
    target_path.mkdir(parents=True, exist_ok=True)
    destination = target_path / filename

    with destination.open('wb') as output_file:
        for chunk in uploaded_file.chunks():
            output_file.write(chunk)

    return destination
