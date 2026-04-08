# Project Structure and Run Guide

This repository contains 4 Django API services, a Next.js frontend, a dedicated Celery workers service, and a root Docker Compose setup.

## Structure

- `ingestion/`
- `management/`
- `notification/`
- `rag/`
- `workers/`
- `frontend/`
- `docker-compose.yml`

Each service folder has:

- `manage.py`
- `<service_name>/settings.py`
- `<service_name>/urls.py`
- `<service_name>/asgi.py`
- `<service_name>/wsgi.py`
- `Dockerfile`

## Ports

Docker Compose maps each service to a different host port:

- Ingestion: `http://localhost:8001`
- Management: `http://localhost:8002`
- Notification: `http://localhost:8003`
- RAG: `http://localhost:8004`

The workers service is a background Celery worker process (no HTTP port).
Redis is exposed on `localhost:6379` for local enqueue/testing.
Elasticsearch is exposed on `localhost:9200`.

## Workers Service (Celery)

The `workers` service is responsible for consuming background jobs enqueued by other services.

Broker/backend defaults:

- `CELERY_BROKER_URL=redis://redis:6379/0`
- `CELERY_RESULT_BACKEND=redis://redis:6379/0`

Registered task names and queue mapping:

- `workers.handle_document_ingestion_job` -> `document_ingestion_jobs`

Each task expects a JSON-serializable payload dictionary.

The worker pipeline:

- For PDFs: direct text extraction, then OCR fallback if extraction is low quality.
- For images: OCR extraction with Tesseract.
- Extracted text is chunked, embedded using Gemini, and indexed in Elasticsearch.

Example enqueue from another service:

```python
from celery import Celery

celery_app = Celery('producer')
celery_app.conf.broker_url = 'redis://redis:6379/0'

celery_app.send_task(
    'workers.handle_document_ingestion_job',
    kwargs={
        'payload': {
            'document_id': 'uuid-here',
            'file_path': '/shared/uploads/uuid-here.pdf',
            'mime_type': 'application/pdf',
            'original_filename': 'contract.pdf',
        }
    },
)
```

## Frontend Integration

The frontend uses the backend as the source of truth:

- `GET /api/drive/` lists drive items
- `POST /api/drive/create_folder/` creates folders
- `PATCH /api/drive/{id}/rename/` renames items
- `PATCH /api/drive/{id}/move/` moves items
- `DELETE /api/drive/{id}/delete_item/` sends items to trash
- `POST /api/drive/{id}/restore/` restores trashed items
- `POST /api/drive/upload_document/` registers uploads after ingestion
- `POST /auth/token/` and `POST /auth/refresh/` handle JWT auth

## Ingestion API

Upload endpoint:

- `POST /api/v1/documents/upload/`
- Content type: `multipart/form-data`
- Form field: `file`
- Supported file types: `application/pdf`, common image MIME types (`png`, `jpg`, `jpeg`, `tiff`, `bmp`, `webp`)

Status endpoint:

- `GET /api/v1/documents/{document_id}/status/`

WebSocket progress endpoint:

- `ws://localhost:8001/ws/uploads/{document_id}/`

WebSocket emits JSON snapshots containing `status`, `progress`, `stage`, and message fields until completion/failure.

## Run with Docker Compose

From the project root:

```bash
docker compose up --build
```

To run in detached mode:

```bash
docker compose up --build -d
```

To stop:

```bash
docker compose down
```

## Run a Single Service Without Docker

Example for `notification`:

```bash
cd notification
../okmenv/bin/python manage.py runserver 0.0.0.0:8000
```

Repeat the same pattern for `ingestion`, `management`, and `rag` by changing directories.

For ingestion metadata tracking, apply migrations:

```bash
docker compose run --rm ingestion python manage.py migrate
```

Before starting full ingestion flow, set Gemini API key in your shell:

```bash
export GEMINI_API_KEY="your-api-key"
```
