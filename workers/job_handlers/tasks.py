from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
import pytesseract
import requests
from celery import shared_task
from elasticsearch import Elasticsearch
from google import genai
from PIL import Image

logger = logging.getLogger(__name__)

MIN_PDF_TEXT_CHARS = 120
DEFAULT_CHUNK_SIZE = 1200
DEFAULT_CHUNK_OVERLAP = 200


def _task_progress(task, status: str, progress: int, stage: str, message: str) -> None:
    task.update_state(state='PROGRESS', meta={'status': status, 'progress': progress, 'stage': stage, 'message': message})


def _count_words(text: str) -> int:
    return len(text.split())


def _extract_pdf_text(pdf_path: Path) -> str:
    with fitz.open(pdf_path) as document:
        return '\n'.join((page.get_text('text') or '') for page in document)


def _ocr_image_bytes(image_bytes: bytes) -> str:
    with Image.open(io.BytesIO(image_bytes)) as img:
        return pytesseract.image_to_string(img)


def _ocr_image_file(image_path: Path) -> str:
    return _ocr_image_bytes(image_path.read_bytes())


def _ocr_pdf(pdf_path: Path, progress_callback=None) -> str:
    text_blocks: list[str] = []
    with fitz.open(pdf_path) as document:
        total_pages = len(document)
        for idx, page in enumerate(document):
            pixmap = page.get_pixmap(dpi=300)
            image_bytes = pixmap.tobytes('png')
            text_blocks.append(_ocr_image_bytes(image_bytes))
            if progress_callback is not None:
                progress_callback(idx + 1, total_pages)
    return '\n'.join(text_blocks)


def _chunk_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_CHUNK_OVERLAP) -> list[str]:
    normalized = ' '.join(text.split())
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = max(end - overlap, 0)
    return chunks


def _embedding_values(response: Any) -> list[float]:
    embeddings = getattr(response, 'embeddings', None)
    if embeddings and len(embeddings) > 0:
        values = getattr(embeddings[0], 'values', None)
        if values is not None:
            return [float(v) for v in values]

    if isinstance(response, dict):
        embeddings_data = response.get('embeddings', [])
        if embeddings_data:
            values = embeddings_data[0].get('values') or []
            return [float(v) for v in values]

    raise ValueError('Unable to parse embedding vector from Gemini response.')


def _ensure_index(es: Elasticsearch, index_name: str, embedding_dims: int) -> None:
    if es.indices.exists(index=index_name):
        return

    mappings = {
        'properties': {
            'document_id': {'type': 'keyword'},
            'chunk_id': {'type': 'keyword'},
            'text': {'type': 'text'},
            'source_type': {'type': 'keyword'},
            'filename': {'type': 'keyword'},
            'created_at': {'type': 'date'},
            'embedding': {'type': 'dense_vector', 'dims': embedding_dims},
            # MAC: nested type guarantees that dept_id + min_ranking conditions are
            # evaluated within the SAME array element, preventing cross-entry
            # false-positive matches across different departments.
            'department_access': {
                'type': 'nested',
                'properties': {
                    'dept_id':     {'type': 'keyword'},
                    'min_ranking': {'type': 'integer'},
                },
            },
        }
    }
    es.indices.create(index=index_name, mappings=mappings)


def _index_document_chunks(
    *,
    document_id: str,
    filename: str,
    source_type: str,
    chunks: list[str],
    vectors: list[list[float]],
) -> int:
    if not chunks:
        return 0

    es_url = os.getenv('ELASTICSEARCH_URL', 'http://elasticsearch:9200')
    index_name = os.getenv('ELASTICSEARCH_INDEX', 'documents_chunks')
    es = Elasticsearch(es_url)

    _ensure_index(es, index_name, len(vectors[0]))

    es.delete_by_query(
        index=index_name,
        body={'query': {'term': {'document_id': document_id}}},
        conflicts='proceed',
        refresh=True,
    )

    for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
        es.index(
            index=index_name,
            id=f'{document_id}:{idx}',
            document={
                'document_id': document_id,
                'chunk_id': f'{document_id}:{idx}',
                'text': chunk,
                'source_type': source_type,
                'filename': filename,
                'embedding': vector,
                'created_at': datetime.now(timezone.utc).isoformat(),
            },
        )

    es.indices.refresh(index=index_name)
    return len(chunks)


@shared_task(name='workers.handle_document_ingestion_job', bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, max_retries=3)
def handle_document_ingestion_job(self, payload: dict[str, Any]) -> dict[str, Any]:
    document_id = str(payload['document_id'])
    file_path = Path(payload['file_path'])
    mime_type = str(payload.get('mime_type', 'application/octet-stream'))
    original_filename = str(payload.get('original_filename', file_path.name))

    # MAC: convert flat dict {"<dept-uuid>": min_ranking, ...} to a list of typed
    # objects [{"dept_id": ..., "min_ranking": ...}] suitable for ES nested mapping.
    raw_access: dict = payload.get('department_access') or {}
    access_list: list[dict] = [
        {'dept_id': str(dept_id), 'min_ranking': int(min_r)}
        for dept_id, min_r in raw_access.items()
    ]

    if not file_path.exists():
        raise FileNotFoundError(f'Uploaded file not found: {file_path}')

    _task_progress(self, 'processing', 2, 'extracting_text', 'Starting text extraction.')

    source_type = 'pdf' if mime_type == 'application/pdf' else 'image'
    text = ''

    if mime_type == 'application/pdf':
        with fitz.open(file_path) as document:
            total_pages = max(len(document), 1)
            text_blocks: list[str] = []
            for idx, page in enumerate(document):
                text_blocks.append(page.get_text('text') or '')
                # Smooth extraction updates in the first 20% of progress.
                extraction_progress = 2 + int(((idx + 1) / total_pages) * 18)
                _task_progress(
                    self,
                    'processing',
                    extraction_progress,
                    'extracting_text',
                    f'Extracting text from PDF page {idx + 1}/{total_pages}.',
                )
            text = '\n'.join(text_blocks)

        if len(text.strip()) < MIN_PDF_TEXT_CHARS:
            _task_progress(self, 'processing', 22, 'ocr_fallback', 'Low PDF text quality detected, running OCR fallback.')

            def ocr_progress(done_pages: int, total_pages: int) -> None:
                progress = 22 + int((done_pages / max(total_pages, 1)) * 13)
                _task_progress(
                    self,
                    'processing',
                    progress,
                    'ocr_fallback',
                    f'Running OCR fallback on page {done_pages}/{total_pages}.',
                )

            text = _ocr_pdf(file_path, progress_callback=ocr_progress)
    elif mime_type.startswith('image/'):
        _task_progress(self, 'processing', 18, 'ocr', 'Running OCR for image upload.')
        text = _ocr_image_file(file_path)
        _task_progress(self, 'processing', 35, 'ocr', 'OCR completed for image upload.')
    else:
        raise ValueError(f'Unsupported MIME type: {mime_type}')

    cleaned_text = text.strip()
    if not cleaned_text:
        raise ValueError('No extractable text found after extraction/OCR.')

    total_words = max(_count_words(cleaned_text), 1)

    _task_progress(self, 'processing', 40, 'chunking', f'Chunking extracted text ({total_words} words detected).')
    chunks = _chunk_text(cleaned_text)
    if not chunks:
        raise ValueError('No chunks generated from extracted text.')

    chunk_word_counts = [max(_count_words(chunk), 1) for chunk in chunks]
    total_chunk_words = max(sum(chunk_word_counts), 1)
    _task_progress(self, 'processing', 48, 'chunking', f'Created {len(chunks)} chunks for embedding.')

    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY is not set.')

    model = os.getenv('GEMINI_EMBEDDING_MODEL', 'text-embedding-004')
    client = genai.Client(api_key=api_key)

    vectors: list[list[float]] = []
    embedded_words = 0
    for idx, chunk in enumerate(chunks):
        response = client.models.embed_content(model=model, contents=chunk)
        vectors.append(_embedding_values(response))

        embedded_words += chunk_word_counts[idx]
        embedding_progress = 48 + int((embedded_words / total_chunk_words) * 30)
        _task_progress(
            self,
            'processing',
            embedding_progress,
            'embedding',
            f'Embedding chunk {idx + 1}/{len(chunks)} ({embedded_words}/{total_chunk_words} words processed).',
        )

    _task_progress(self, 'processing', 80, 'indexing', 'Preparing Elasticsearch index.')

    es_url = os.getenv('ELASTICSEARCH_URL', 'http://elasticsearch:9200')
    index_name = os.getenv('ELASTICSEARCH_INDEX', 'documents_chunks')
    es = Elasticsearch(es_url)

    _ensure_index(es, index_name, len(vectors[0]))

    es.delete_by_query(
        index=index_name,
        body={'query': {'term': {'document_id': document_id}}},
        conflicts='proceed',
        refresh=True,
    )

    indexed_words = 0
    for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
        es.index(
            index=index_name,
            id=f'{document_id}:{idx}',
            document={
                'document_id': document_id,
                'chunk_id': f'{document_id}:{idx}',
                'text': chunk,
                'source_type': source_type,
                'filename': original_filename,
                'embedding': vector,
                'created_at': datetime.now(timezone.utc).isoformat(),
                # MAC: embed the nested access list into every chunk so the RAG
                # retrieval filter can enforce per-department ranking at query time.
                'department_access': access_list,
            },
        )

        indexed_words += chunk_word_counts[idx]
        indexing_progress = 80 + int((indexed_words / total_chunk_words) * 19)
        _task_progress(
            self,
            'processing',
            indexing_progress,
            'indexing',
            f'Indexed chunk {idx + 1}/{len(chunks)} ({indexed_words}/{total_chunk_words} words).',
        )

    es.indices.refresh(index=index_name)
    indexed_chunks = len(chunks)

    result = {
        'document_id': document_id,
        'status': 'completed',
        'progress': 100,
        'stage': 'completed',
        'message': 'Document ingested successfully.',
        'chunk_count': indexed_chunks,
        'source_type': source_type,
    }

    logger.info('Document ingestion completed document_id=%s chunks=%s', document_id, indexed_chunks)

    # --- Trigger milestone check (fire-and-forget, non-blocking) ---
    _trigger_milestone_check(
        document_id=document_id,
        filename=original_filename,
        department_ids=[e['dept_id'] for e in access_list],
    )

    return result


# ---------------------------------------------------------------------------
# Helpers: milestone integration
# ---------------------------------------------------------------------------

def _trigger_milestone_check(
    document_id: str,
    filename: str,
    department_ids: list[str],
) -> None:
    """
    Non-blocking HTTP call to the RAG planning service.
    Failures are logged but never propagate to the ingestion pipeline.
    """
    rag_url = os.getenv('RAG_INTERNAL_URL', 'http://rag:8000')
    secret = os.getenv('PLANNING_SERVICE_SECRET', '')
    if not secret:
        logger.debug('PLANNING_SERVICE_SECRET not set — skipping milestone check.')
        return
    try:
        requests.post(
            f'{rag_url}/api/planning/internal/check-document/',
            json={
                'document_id': document_id,
                'filename': filename,
                'department_ids': department_ids,
            },
            headers={'X-Service-Secret': secret},
            timeout=10,
        )
        logger.debug('Milestone check triggered for document_id=%s', document_id)
    except Exception as exc:
        logger.warning('Milestone check call failed (non-fatal): %s', exc)


@shared_task(
    name='planning.trigger_milestone_sweep',
    bind=False,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=2,
)
def trigger_milestone_sweep() -> dict:
    """
    Celery Beat periodic task (fired hourly by default).
    Calls the RAG service's internal sweep endpoint so all AI logic
    remains within the planning app.
    """
    rag_url = os.getenv('RAG_INTERNAL_URL', 'http://rag:8000')
    secret = os.getenv('PLANNING_SERVICE_SECRET', '')

    if not secret:
        logger.error('PLANNING_SERVICE_SECRET is not set — skipping sweep.')
        return {'error': 'PLANNING_SERVICE_SECRET not configured'}

    try:
        resp = requests.post(
            f'{rag_url}/api/planning/internal/sweep/',
            headers={'X-Service-Secret': secret},
            timeout=300,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info('Periodic milestone sweep complete: %s', result)
        return result
    except requests.HTTPError as exc:
        logger.error(
            'Sweep HTTP error %s: %s', exc.response.status_code, exc.response.text[:200]
        )
        raise
    except Exception as exc:
        logger.error('Sweep request failed: %s', exc)
        raise
