from __future__ import annotations

from django.conf import settings
from elasticsearch import Elasticsearch
from google import genai

_es_client: Elasticsearch | None = None
_genai_client: genai.Client | None = None


def get_es_client() -> Elasticsearch:
    """Return a lazily-initialized Elasticsearch client."""
    global _es_client
    if _es_client is None:
        _es_client = Elasticsearch(settings.ELASTICSEARCH_URL)
    return _es_client


def get_genai_client() -> genai.Client:
    """Return a lazily-initialized Google GenAI client."""
    global _genai_client
    if _genai_client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError('GEMINI_API_KEY is not configured.')
        _genai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _genai_client
