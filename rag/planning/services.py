"""
Core AI + data services for the Planning feature.

Two main orchestration paths:

1. Per-upload check (called by workers via HTTP):
   process_document_for_milestones(document_id, filename, department_ids)
   → fetches document chunks from ES → checks each OPEN milestone → auto-completes matches

2. Periodic sweep (Celery Beat, hourly):
   sweep_all_open_milestones()
   → for each OPEN milestone, embeds milestone description → kNN searches ES
   → checks top-K chunks → auto-completes matches
"""
from __future__ import annotations

import json
import logging

from django.conf import settings

from query.clients import get_es_client, get_genai_client

from .models import Milestone, Plan, PlanningNotification

logger = logging.getLogger(__name__)

# Maximum characters of document text sent to Gemini for milestone checking.
_MAX_DOC_TEXT_CHARS = 4000
# Number of top chunks retrieved per milestone in the periodic sweep.
_SWEEP_TOP_K = 8

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_MILESTONE_CHECK_PROMPT = """\
You are an organizational planning assistant.

## Milestone
Title: {title}
Description: {description}

## Document Content (excerpts — up to {max_chars} characters)
{document_text}

## Task
Determine whether the document above provides clear, direct evidence
that the milestone described has been achieved or completed.

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "is_satisfied": true,
  "confidence": "high",
  "summary": "2-3 sentences describing how the document satisfies the milestone."
}}

Rules:
- Set is_satisfied=true ONLY when the document directly and unambiguously addresses the milestone.
- confidence must be one of: "high", "medium", or "low".
- Use confidence="low" when you are uncertain — the system will NOT auto-complete on low confidence.
- When in doubt, return is_satisfied=false.
- The summary field must always be present (explain why the document does or does not satisfy the milestone).
"""


# ---------------------------------------------------------------------------
# Elasticsearch helpers
# ---------------------------------------------------------------------------

def get_document_chunks_text(document_id: str) -> str:
    """
    Fetch all indexed chunks for the given document_id via ES term filter
    and return concatenated text (truncated to _MAX_DOC_TEXT_CHARS).
    Returns empty string if document is not found in the index.
    """
    es = get_es_client()
    try:
        response = es.search(
            index=settings.ELASTICSEARCH_INDEX,
            body={
                'query': {'term': {'document_id': document_id}},
                '_source': ['text'],
                'size': 50,  # up to 50 chunks per document
            },
        )
        parts = [
            hit['_source'].get('text', '')
            for hit in response['hits']['hits']
        ]
        full_text = '\n'.join(parts)
        return full_text[:_MAX_DOC_TEXT_CHARS]
    except Exception as exc:
        logger.error('ES chunk fetch failed for document_id=%s: %s', document_id, exc)
        return ''


def get_milestone_relevant_chunks(
    milestone_description: str,
    department_ids: list[str],
    rejected_document_ids: list[str],
    top_k: int = _SWEEP_TOP_K,
) -> tuple[str, str | None, str | None]:
    """
    For the periodic sweep.  Embeds the milestone description and performs a
    department-filtered kNN search to find the most relevant document chunks.

    Returns (concatenated_text, best_document_id, best_filename).
    Text is truncated to _MAX_DOC_TEXT_CHARS.  Returns ('', None, None) on error.
    """
    try:
        client = get_genai_client()
        resp = client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=milestone_description,
        )
        embeddings = getattr(resp, 'embeddings', None)
        if not embeddings:
            raise ValueError('Empty embedding response')
        vector = [float(v) for v in embeddings[0].values]
    except Exception as exc:
        logger.error('Embedding failed for milestone sweep: %s', exc)
        return '', None, None

    es = get_es_client()
    # Build a department filter that also excludes rejected documents.
    dept_filter: dict = {
        'bool': {
            'must': [
                {
                    'nested': {
                        'path': 'department_access',
                        'query': {
                            'terms': {'department_access.dept_id': department_ids}
                        },
                    }
                }
            ],
            'must_not': (
                [{'terms': {'document_id': rejected_document_ids}}]
                if rejected_document_ids else []
            ),
        }
    }

    try:
        response = es.search(
            index=settings.ELASTICSEARCH_INDEX,
            body={
                'knn': {
                    'field': 'embedding',
                    'query_vector': vector,
                    'k': top_k,
                    'num_candidates': top_k * 10,
                    'filter': dept_filter,
                },
                '_source': ['text', 'document_id', 'filename'],
                'size': top_k,
            },
        )
        hits = response['hits']['hits']
        if not hits:
            return '', None, None

        parts = [hit['_source'].get('text', '') for hit in hits]
        best_hit = hits[0]['_source']
        best_doc_id = best_hit.get('document_id')
        best_filename = best_hit.get('filename')

        full_text = '\n'.join(parts)
        return full_text[:_MAX_DOC_TEXT_CHARS], best_doc_id, best_filename

    except Exception as exc:
        logger.error('ES kNN sweep search failed: %s', exc)
        return '', None, None


# ---------------------------------------------------------------------------
# Gemini helper
# ---------------------------------------------------------------------------

def check_milestone_against_text(
    milestone: Milestone,
    document_text: str,
) -> tuple[bool, str, str]:
    """
    Send the milestone + document text to Gemini.
    Returns (is_satisfied, confidence, summary).
    Defaults to (False, 'low', '') on any error.
    """
    if not document_text.strip():
        return False, 'low', 'No document text available for analysis.'

    prompt = _MILESTONE_CHECK_PROMPT.format(
        title=milestone.title,
        description=milestone.description,
        document_text=document_text,
        max_chars=_MAX_DOC_TEXT_CHARS,
    )

    try:
        client = get_genai_client()
        response = client.models.generate_content(
            model=settings.GEMINI_GENERATIVE_MODEL,
            contents=prompt,
        )
        raw = (getattr(response, 'text', None) or '').strip()

        # Strip markdown code fences if model wraps the JSON
        if raw.startswith('```'):
            raw = raw.strip('`').strip()
            if raw.lower().startswith('json'):
                raw = raw[4:].strip()

        data = json.loads(raw)
        is_satisfied: bool = bool(data.get('is_satisfied', False))
        confidence: str = str(data.get('confidence', 'low')).lower()
        summary: str = str(data.get('summary', ''))

        if confidence not in ('high', 'medium', 'low'):
            confidence = 'low'

        return is_satisfied, confidence, summary

    except json.JSONDecodeError as exc:
        logger.warning(
            'Gemini returned non-JSON for milestone %s: %s — raw=%r',
            milestone.id, exc, raw[:200],
        )
        return False, 'low', ''
    except Exception as exc:
        logger.error('Gemini check failed for milestone %s: %s', milestone.id, exc)
        return False, 'low', ''


# ---------------------------------------------------------------------------
# Notification helper
# ---------------------------------------------------------------------------

def _create_notification(milestone: Milestone) -> None:
    """Create an in-app PlanningNotification for the plan owner."""
    plan = milestone.plan
    PlanningNotification.objects.create(
        user_id=plan.created_by_user_id,
        milestone=milestone,
        message=(
            f'Milestone "{milestone.title}" in plan "{plan.title}" was automatically '
            f'marked complete (confidence: {milestone.completion_confidence}). '
            f'Reference: {milestone.reference_filename or milestone.reference_document_id}. '
            f'You may reject this if it is incorrect.'
        ),
    )


# ---------------------------------------------------------------------------
# Auto-complete helper
# ---------------------------------------------------------------------------

_AUTO_COMPLETE_CONFIDENCES = ('high', 'medium')


def _maybe_auto_complete(
    milestone: Milestone,
    document_id: str,
    filename: str,
    is_satisfied: bool,
    confidence: str,
    summary: str,
) -> bool:
    """
    Apply auto-completion if conditions are met.
    Returns True if the milestone was completed, False otherwise.
    """
    if not is_satisfied:
        return False
    if confidence not in _AUTO_COMPLETE_CONFIDENCES:
        logger.debug(
            'Skipping milestone %s — low confidence (%s)', milestone.id, confidence
        )
        return False
    if document_id in (milestone.rejected_document_ids or []):
        logger.debug(
            'Skipping milestone %s — document %s was previously rejected',
            milestone.id, document_id,
        )
        return False

    milestone.mark_auto_complete(
        document_id=document_id,
        filename=filename,
        summary=summary,
        confidence=confidence,
    )
    _create_notification(milestone)
    logger.info(
        'Milestone %s auto-completed by document %s (confidence=%s)',
        milestone.id, document_id, confidence,
    )
    return True


# ---------------------------------------------------------------------------
# Orchestrator 1: Per-upload check (called by workers HTTP callback)
# ---------------------------------------------------------------------------

def process_document_for_milestones(
    document_id: str,
    filename: str,
    department_ids: list[str],
) -> list[dict]:
    """
    Per-upload trigger:
    1. Fetch this document's chunks text from ES.
    2. Find all OPEN milestones whose plan.department_id is in department_ids
       and where document_id is NOT in their rejected_document_ids.
    3. For each, ask Gemini if the document satisfies it.
    4. Auto-complete on high/medium confidence.
    5. Return a summary list of results.
    """
    document_text = get_document_chunks_text(document_id)
    if not document_text:
        logger.warning(
            'No text found in ES for document_id=%s — skipping milestone check.',
            document_id,
        )
        return []

    open_milestones = Milestone.objects.filter(
        status=Milestone.Status.OPEN,
        plan__department_id__in=department_ids,
        plan__is_active=True,
    ).select_related('plan')

    results = []
    for milestone in open_milestones:
        # Skip if this document was previously rejected for this milestone
        if document_id in (milestone.rejected_document_ids or []):
            continue

        is_satisfied, confidence, summary = check_milestone_against_text(
            milestone, document_text
        )
        completed = _maybe_auto_complete(
            milestone, document_id, filename, is_satisfied, confidence, summary
        )
        results.append({
            'milestone_id': str(milestone.id),
            'milestone_title': milestone.title,
            'completed': completed,
            'confidence': confidence,
            'summary': summary,
        })

    logger.info(
        'Per-upload check for doc=%s dept=%s: %d milestones checked, %d completed.',
        document_id, department_ids,
        len(results), sum(1 for r in results if r['completed']),
    )
    return results


# ---------------------------------------------------------------------------
# Orchestrator 2: Periodic sweep (Celery Beat, hourly)
# ---------------------------------------------------------------------------

def sweep_all_open_milestones() -> dict:
    """
    Periodic sweep:
    For every OPEN milestone across all active plans:
    1. Embed the milestone description.
    2. kNN-search ES (department-scoped, excluding rejected docs).
    3. Ask Gemini if the top chunks satisfy the milestone.
    4. Auto-complete on high/medium confidence.

    Returns a stats dict.
    """
    open_milestones = Milestone.objects.filter(
        status=Milestone.Status.OPEN,
        plan__is_active=True,
    ).select_related('plan')

    total = open_milestones.count()
    completed_count = 0
    skipped_count = 0

    logger.info('Milestone sweep started: %d open milestones to check.', total)

    for milestone in open_milestones:
        plan = milestone.plan
        department_ids = [plan.department_id]
        rejected_ids: list[str] = milestone.rejected_document_ids or []

        doc_text, best_doc_id, best_filename = get_milestone_relevant_chunks(
            milestone_description=milestone.description,
            department_ids=department_ids,
            rejected_document_ids=rejected_ids,
        )

        if not doc_text or not best_doc_id:
            skipped_count += 1
            continue

        # Avoid re-triggering from a previously rejected document
        if best_doc_id in rejected_ids:
            skipped_count += 1
            continue

        is_satisfied, confidence, summary = check_milestone_against_text(
            milestone, doc_text
        )
        completed = _maybe_auto_complete(
            milestone, best_doc_id, best_filename or '', is_satisfied, confidence, summary
        )
        if completed:
            completed_count += 1
        else:
            skipped_count += 1

    result = {
        'total_checked': total,
        'auto_completed': completed_count,
        'skipped': skipped_count,
    }
    logger.info('Milestone sweep done: %s', result)
    return result
