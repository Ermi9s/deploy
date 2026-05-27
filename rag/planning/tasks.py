"""
Celery task for the periodic milestone sweep.

This task is registered in the workers service and triggered by Celery Beat
(-B flag on the worker).  It calls the RAG service's internal sweep endpoint
so all sweep logic remains within the planning app.
"""
from __future__ import annotations

import logging
import os

import requests
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name='planning.trigger_milestone_sweep',
    bind=False,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=2,
)
def trigger_milestone_sweep() -> dict:
    """
    Celery Beat periodic task.
    Fires an HTTP POST to /api/planning/internal/sweep/ on the RAG service.
    The RAG service executes the full AI-based sweep and returns stats.
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
            timeout=300,  # allow up to 5 minutes for large corpora
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info('Periodic milestone sweep complete: %s', result)
        return result
    except requests.HTTPError as exc:
        logger.error('Sweep HTTP error: %s — %s', exc, exc.response.text[:200])
        raise
    except Exception as exc:
        logger.error('Sweep request failed: %s', exc)
        raise
