from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
import pytesseract
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
    return result


# ---------------------------------------------------------------------------
# Report generation — Scatter-Gather RAG
# ---------------------------------------------------------------------------

import asyncio
import uuid as _uuid
from channels.layers import get_channel_layer



def _push_ws_event(group_name: str, event: dict) -> None:
    """Send a message to a Django-Channels group from synchronous Celery code."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            channel_layer.group_send(group_name, {"type": "report.progress", **event})
        )
    finally:
        loop.close()


def _embed_query_sync(question: str) -> list[float]:
    """Embed a query synchronously using the Gemini embedding model."""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY is not set.')
    model = os.getenv('GEMINI_EMBEDDING_MODEL', 'text-embedding-004')
    client = genai.Client(api_key=api_key)
    response = client.models.embed_content(model=model, contents=question)
    return _embedding_values(response)


def _retrieve_chunks_sync(
    query_vector: list[float],
    top_k: int,
    department_id: str | None,
    permission_ranking: int | None,
) -> list[dict]:
    """
    Perform MAC-filtered k-NN search against Elasticsearch.

    Applies the same nested-filter pattern used by the RAG chat consumer so
    that department access rules are never violated during report generation.
    """
    es_url = os.getenv('ELASTICSEARCH_URL', 'http://elasticsearch:9200')
    index_name = os.getenv('ELASTICSEARCH_INDEX', 'documents_chunks')
    es = Elasticsearch(es_url)

    knn_clause: dict = {
        "field": "embedding",
        "query_vector": query_vector,
        "k": top_k,
        "num_candidates": top_k * 10,
    }

    # MAC filter — mirrors retrieve_chunks() in the RAG service
    if department_id and permission_ranking is not None:
        knn_clause["filter"] = {
            "nested": {
                "path": "department_access",
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"department_access.dept_id": str(department_id)}},
                            {"range": {"department_access.min_ranking": {"lte": int(permission_ranking)}}},
                        ]
                    }
                },
            }
        }

    body = {
        "knn": knn_clause,
        "_source": ["document_id", "chunk_id", "text", "filename", "source_type"],
        "size": top_k,
    }

    response = es.search(index=index_name, body=body)
    chunks = []
    for hit in response["hits"]["hits"]:
        src = hit["_source"]
        chunks.append({
            "chunk_id": src.get("chunk_id", hit["_id"]),
            "document_id": src.get("document_id", ""),
            "filename": src.get("filename", ""),
            "text": src.get("text", ""),
            "score": hit["_score"],
        })
    return chunks


def _draft_sub_report(agenda_text: str, chunks: list[dict]) -> str:
    """Call Gemini to generate a focused sub-report section for one agenda."""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY is not set.')
    model = os.getenv('GEMINI_GENERATIVE_MODEL', 'gemini-2.0-flash')
    client = genai.Client(api_key=api_key)

    context_parts = [
        f"--- Source {i} (file: {c['filename']}) ---\n{c['text']}"
        for i, c in enumerate(chunks, start=1)
    ]
    context_block = "\n\n".join(context_parts)

    prompt = (
        "You are an expert analyst drafting a section of a formal organizational report. "
        "Write a thorough, well-structured section ONLY for the agenda item below, "
        "using ONLY the provided context. Use Markdown formatting (headers, bullets, bold). "
        "If the context lacks sufficient information, state that clearly.\n\n"
        f"### Agenda Item\n{agenda_text}\n\n"
        f"### Context\n{context_block}\n\n"
        "### Section Report"
    )

    response = client.models.generate_content(model=model, contents=prompt)
    return (getattr(response, "text", None) or "").strip()


def _synthesise_report(title: str, sections: list[tuple[str, str]]) -> str:
    """Call Gemini to stitch sub-reports into a cohesive final report."""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY is not set.')
    model = os.getenv('GEMINI_GENERATIVE_MODEL', 'gemini-2.0-flash')
    client = genai.Client(api_key=api_key)

    sections_block = "\n\n".join(
        f"## {agenda}\n{sub_report}" for agenda, sub_report in sections
    )

    prompt = (
        "You are a senior technical writer. You have been given a set of independently "
        "drafted sub-reports, one per agenda item. Your task is to synthesise them into "
        "a single, cohesive, professionally formatted report with smooth transitions, "
        "an executive summary, and a conclusion. Use Markdown. Do NOT add information "
        "that is not present in the sub-reports.\n\n"
        f"# Report Title: {title}\n\n"
        f"{sections_block}\n\n"
        "---\n"
        "Now write the final synthesised report:"
    )

    response = client.models.generate_content(model=model, contents=prompt)
    return (getattr(response, "text", None) or "").strip()


def _process_one_agenda(
    agenda_id: str,
    agenda_text: str,
    order: int,
    department_id: str | None,
    permission_ranking: int | None,
    top_k: int,
    group_name: str,
) -> tuple[str, list[dict], str]:
    """
    Full pipeline for one agenda item (runs in a thread-pool executor):
      embed → retrieve (MAC-filtered) → draft sub-report
    Returns (sub_report_text, sources_list, error_message)
    """
    try:
        _push_ws_event(group_name, {
            "event_type": "agenda_progress",
            "agenda_id": agenda_id,
            "order": order,
            "message": f"Retrieving documents for agenda {order + 1}…",
        })

        vector = _embed_query_sync(agenda_text)
        chunks = _retrieve_chunks_sync(vector, top_k, department_id, permission_ranking)

        sources = [
            {
                "document_id": c["document_id"],
                "chunk_id": c["chunk_id"],
                "filename": c["filename"],
                "score": round(c.get("score", 0.0), 4),
            }
            for c in chunks
        ]

        _push_ws_event(group_name, {
            "event_type": "agenda_progress",
            "agenda_id": agenda_id,
            "order": order,
            "message": f"Drafting sub-report for agenda {order + 1}…",
        })

        sub_report = _draft_sub_report(agenda_text, chunks) if chunks else (
            f"*No accessible documents found for agenda item: {agenda_text}*"
        )

        return sub_report, sources, ""

    except Exception as exc:
        logger.exception("Agenda %s processing failed: %s", agenda_id, exc)
        return "", [], str(exc)


@shared_task(
    name='job_handlers.tasks.generate_report_task',
    bind=True,
    max_retries=0,
)
def generate_report_task(self, payload: dict) -> dict:
    """
    Scatter-Gather RAG report generation.

    Receives a self-contained payload from the RAG service:
      {
        "job_id":             str (UUID),
        "title":              str,
        "department_id":      str | None,
        "permission_ranking": int | None,
        "top_k":              int,
        "agendas": [{"id": str, "order": int, "text": str}, ...]
      }

    The worker reads everything it needs from the payload -- NO DB reads.
    It only writes back results (status, sub_reports, final_report) via the
    rag_report mirror models using .update() queryset calls.

    Pipeline:
      1. Mark job as running.
      2. SCATTER: process each agenda in parallel (embed -> MAC-filtered ES -> draft).
      3. GATHER: synthesise sub-reports into final report via Gemini.
      4. Persist results; push WebSocket completion event.
    """
    from rag_report.models import ReportAgenda, ReportJob

    job_id: str = payload["job_id"]
    title: str = payload["title"]
    department_id: str | None = payload.get("department_id")
    permission_ranking: int | None = payload.get("permission_ranking")
    top_k: int = int(payload.get("top_k", os.getenv("REPORT_TOP_K_PER_AGENDA", "8")))
    agenda_items: list[dict] = payload.get("agendas", [])
    group_name = f"report_{job_id}"
    total = len(agenda_items)

    # Mark job running (write-only -- no SELECT needed)
    ReportJob.objects.filter(id=job_id).update(status="running")

    _push_ws_event(group_name, {
        "event_type": "progress",
        "percent": 5,
        "message": f"Starting report generation for {total} agenda(s)...",
    })

    # Mark all agendas running upfront so the UI shows live status immediately
    agenda_ids = [a["id"] for a in agenda_items]
    ReportAgenda.objects.filter(id__in=agenda_ids).update(status="running")

    # -- SCATTER: parallel agenda processing ----------------------------------
    from concurrent.futures import ThreadPoolExecutor, as_completed

    futures_map: dict = {}
    results: dict[str, tuple[str, list, str]] = {}  # agenda_id -> (sub_report, sources, error)

    with ThreadPoolExecutor(max_workers=min(total, 5)) as executor:
        for agenda in agenda_items:
            future = executor.submit(
                _process_one_agenda,
                agenda["id"],
                agenda["text"],
                agenda["order"],
                department_id,
                permission_ranking,
                top_k,
                group_name,
            )
            futures_map[future] = agenda

        completed_count = 0
        for future in as_completed(futures_map):
            agenda = futures_map[future]
            sub_report, sources, error = future.result()
            completed_count += 1
            percent = 10 + int((completed_count / total) * 70)

            if error:
                ReportAgenda.objects.filter(id=agenda["id"]).update(
                    status="failed",
                    sub_report=f"*Error: {error}*",
                    sources=[],
                )
            else:
                ReportAgenda.objects.filter(id=agenda["id"]).update(
                    status="completed",
                    sub_report=sub_report,
                    sources=sources,
                )

            results[agenda["id"]] = (sub_report, sources, error)

            _push_ws_event(group_name, {
                "event_type": "agenda_done",
                "agenda_id": agenda["id"],
                "order": agenda["order"],
                "sub_report": sub_report,
                "sources": sources,
                "percent": percent,
            })

    # -- GATHER: synthesise ---------------------------------------------------
    _push_ws_event(group_name, {
        "event_type": "progress",
        "percent": 85,
        "message": "Synthesising final report...",
    })

    sections = [
        (a["text"], results[a["id"]][0])
        for a in agenda_items
        if a["id"] in results and not results[a["id"]][2]  # no error
    ]

    if not sections:
        error_msg = "All agenda items failed to retrieve content."
        ReportJob.objects.filter(id=job_id).update(
            status="failed", error_message=error_msg
        )
        _push_ws_event(group_name, {"event_type": "error", "message": error_msg})
        return {"error": error_msg}

    try:
        final_report = _synthesise_report(title, sections)
    except Exception as exc:
        logger.exception("Report synthesis failed for job %s", job_id)
        error_msg = str(exc)
        ReportJob.objects.filter(id=job_id).update(
            status="failed", error_message=error_msg
        )
        _push_ws_event(group_name, {"event_type": "error", "message": error_msg})
        return {"error": error_msg}

    ReportJob.objects.filter(id=job_id).update(
        final_report=final_report, status="completed"
    )

    _push_ws_event(group_name, {
        "event_type": "report_done",
        "job_id": job_id,
        "final_report": final_report,
        "percent": 100,
    })

    logger.info("Report generation completed job_id=%s", job_id)
    return {"job_id": job_id, "status": "completed"}
