from __future__ import annotations

import asyncio
import logging
import time

from django.conf import settings

from .clients import get_es_client, get_genai_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Retry configuration
# ---------------------------------------------------------------------------

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 2.0   # seconds — doubles on each attempt
_RETRYABLE_STATUS_CODES = {429, 500, 503}


def _is_retryable_genai_error(exc: Exception) -> bool:
    """Return True for transient Gemini API errors worth retrying."""
    try:
        from google.genai.errors import ServerError, ClientError  # noqa: F401
        if isinstance(exc, ServerError):
            code = getattr(exc, "status_code", 0) or 0
            return int(code) in _RETRYABLE_STATUS_CODES
    except ImportError:
        pass
    # Fall back to string inspection for older SDK versions
    msg = str(exc).lower()
    return any(k in msg for k in ("503", "unavailable", "rate limit", "429", "overloaded"))


# ---------------------------------------------------------------------------
# Synchronous embedding / retrieval helpers
# ---------------------------------------------------------------------------

def embed_query(question: str) -> list[float]:
    """Embed the user question using the same Gemini model used at ingestion time."""
    client = get_genai_client()
    response = client.models.embed_content(
        model=settings.GEMINI_EMBEDDING_MODEL,
        contents=question,
    )
    embeddings = getattr(response, "embeddings", None)
    if embeddings and len(embeddings) > 0:
        values = getattr(embeddings[0], "values", None)
        if values is not None:
            return [float(v) for v in values]
    raise ValueError("Failed to generate embedding for the query.")


def retrieve_chunks(
    query_vector: list[float],
    top_k: int | None = None,
    department_id: str | None = None,
    permission_ranking: int | None = None,
) -> list[dict]:
    """
    Perform a k-NN search against the Elasticsearch documents_chunks index.

    When `department_id` and `permission_ranking` are provided (extracted from
    the caller's JWT), a strict MAC filter is applied:
      1. The chunk must list the caller's department in its `department_access`.
      2. The caller's ranking must be >= the chunk's `min_ranking` for that dept.

    Both conditions are evaluated within the same nested object so that dept_id
    and min_ranking from different departments can never cross-contaminate.
    """
    es = get_es_client()
    k = top_k or settings.RAG_TOP_K

    knn_clause: dict = {
        "field": "embedding",
        "query_vector": query_vector,
        "k": k,
        "num_candidates": k * 10,
    }

    # --- MAC filter ---------------------------------------------------
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
    # ------------------------------------------------------------------

    body = {
        "knn": knn_clause,
        "_source": ["document_id", "chunk_id", "text", "filename", "source_type"],
        "size": k,
    }

    response = es.search(index=settings.ELASTICSEARCH_INDEX, body=body)

    chunks = []
    for hit in response["hits"]["hits"]:
        source = hit["_source"]
        chunks.append({
            "chunk_id": source.get("chunk_id", hit["_id"]),
            "document_id": source.get("document_id", ""),
            "filename": source.get("filename", ""),
            "text": source.get("text", ""),
            "score": hit["_score"],
        })
    return chunks


def build_rag_prompt(question: str, chunks: list[dict]) -> str:
    """Construct the augmented prompt for the generative model."""
    context_parts = []
    for i, chunk in enumerate(chunks, start=1):
        context_parts.append(
            f'--- Source {i} (file: {chunk["filename"]}) ---\n{chunk["text"]}'
        )

    context_block = "\n\n".join(context_parts)

    return (
        "You are an expert assistant for an organizational knowledge management system. "
        "Answer the user's question using ONLY the context provided below. "
        "If the context does not contain enough information, say so clearly.\n\n"
        f"### Context\n{context_block}\n\n"
        f"### Question\n{question}\n\n"
        "### Answer"
    )


def generate_answer(prompt: str) -> str:
    """Call the Gemini generative model with the augmented prompt."""
    client = get_genai_client()
    response = client.models.generate_content(
        model=settings.GEMINI_GENERATIVE_MODEL,
        contents=prompt,
    )
    return response.text


# ---------------------------------------------------------------------------
# Streaming / multi-turn helpers (used by the WebSocket ChatConsumer)
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are an expert assistant for an organizational knowledge management system. "
    "Answer the user's question using ONLY the context provided below. "
    "If the context does not contain enough information, say so clearly. "
    "Be concise, accurate, and professional."
)


def build_chat_messages(
    question: str,
    chunks: list[dict],
    history: list[dict],
) -> list[dict]:
    """
    Build the ``contents`` list for a Gemini multi-turn request.

    Structure:
        [
          {"role": "user",  "parts": [system_prompt + context_block]},
          {"role": "model", "parts": ["Understood."]},
          # ... validated, interleaved history pairs ...
          {"role": "user",  "parts": [question]},
        ]

    The system prompt + retrieved context are injected as the very first
    user turn so they are always in scope regardless of history length.
    History is validated to ensure roles alternate (user → model → user…).
    """
    context_parts = []
    for i, chunk in enumerate(chunks, start=1):
        context_parts.append(
            f"--- Source {i} (file: {chunk['filename']}) ---\n{chunk['text']}"
        )
    context_block = "\n\n".join(context_parts)

    first_user_turn = f"{_SYSTEM_PROMPT}\n\n### Retrieved Context\n{context_block}"

    messages: list[dict] = [
        {"role": "user", "parts": [{"text": first_user_turn}]},
        {"role": "model", "parts": [{"text": "Understood. I will answer using only the provided context."}]},
    ]

    # Validate and append history so roles always alternate correctly.
    # The last injected message above has role="model", so next must be "user".
    expected_role = "user"
    for entry in history:
        role = entry.get("role", "")
        content = (entry.get("content") or "").strip()
        if not content:
            continue
        if role not in ("user", "model"):
            continue
        if role != expected_role:
            # Skip entries that would break the alternating pattern
            logger.debug("Skipping history entry with unexpected role '%s' (expected '%s')", role, expected_role)
            continue
        messages.append({"role": role, "parts": [{"text": content}]})
        expected_role = "model" if role == "user" else "user"

    # Ensure the final turn before the new question is from the model.
    # If the last validated history entry was "user" we need to add a
    # filler model turn to keep the schema valid.
    if messages and messages[-1]["role"] == "user":
        messages.append({"role": "model", "parts": [{"text": "Understood."}]})

    # Finally, the current question
    messages.append({"role": "user", "parts": [{"text": question}]})

    return messages


def generate_answer_stream(messages: list[dict]):
    """
    Call the Gemini generative model in synchronous streaming mode.

    Yields individual text tokens (strings) as they arrive.
    """
    client = get_genai_client()
    for chunk in client.models.generate_content_stream(
        model=settings.GEMINI_GENERATIVE_MODEL,
        contents=messages,
    ):
        text = getattr(chunk, "text", None)
        if text:
            yield text


# ---------------------------------------------------------------------------
# Async variants with retry logic
# ---------------------------------------------------------------------------

async def async_embed_query(question: str) -> list[float]:
    """
    Embed the user question asynchronously using the Gemini embedding model.

    Retries up to _MAX_RETRIES times on transient API errors (503, 429, etc.)
    with exponential back-off.
    """
    client = get_genai_client()
    delay = _RETRY_BASE_DELAY

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = await client.aio.models.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                contents=question,
            )
            embeddings = getattr(response, "embeddings", None)
            if embeddings and len(embeddings) > 0:
                values = getattr(embeddings[0], "values", None)
                if values is not None:
                    return [float(v) for v in values]
            raise ValueError("Failed to generate embedding for the query: empty response.")

        except Exception as exc:
            if _is_retryable_genai_error(exc) and attempt < _MAX_RETRIES:
                logger.warning(
                    "Gemini embed_content transient error (attempt %d/%d): %s — retrying in %.1fs",
                    attempt, _MAX_RETRIES, exc, delay,
                )
                await asyncio.sleep(delay)
                delay *= 2
                continue
            raise

    raise RuntimeError("async_embed_query: exhausted all retries")


async def async_generate_answer_stream(messages: list[dict]):
    """
    Call the Gemini generative model in async streaming mode with retry logic.

    On transient Gemini errors (503 UNAVAILABLE, 429 rate-limit, etc.) the
    function waits with exponential back-off and retries up to _MAX_RETRIES
    times before propagating the exception.

    Yields individual text token strings.
    """
    client = get_genai_client()
    delay = _RETRY_BASE_DELAY

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response_stream = await client.aio.models.generate_content_stream(
                model=settings.GEMINI_GENERATIVE_MODEL,
                contents=messages,
            )
            async for chunk in response_stream:
                text = getattr(chunk, "text", None)
                if text:
                    yield text
            return  # Stream completed successfully — exit the retry loop

        except Exception as exc:
            if _is_retryable_genai_error(exc) and attempt < _MAX_RETRIES:
                logger.warning(
                    "Gemini generate_content_stream transient error (attempt %d/%d): %s — retrying in %.1fs",
                    attempt, _MAX_RETRIES, exc, delay,
                )
                await asyncio.sleep(delay)
                delay *= 2
                continue
            # Non-retryable or exhausted retries — re-raise
            logger.error(
                "Gemini generate_content_stream failed after %d attempt(s): %s",
                attempt, exc,
            )
            raise


# ---------------------------------------------------------------------------
# Session title generation
# ---------------------------------------------------------------------------

async def async_generate_session_title(question: str) -> str:
    """
    Ask Gemini to produce a short, descriptive session title (3–6 words)
    based on the user's opening question.

    Falls back to the first 60 characters of the question if the API call
    fails — ensuring the consumer is never blocked by a title-generation error.
    """
    client = get_genai_client()
    prompt = (
        "Generate a short, descriptive title (3 to 6 words, no punctuation at the end) "
        f"for a chat session that begins with this question:\n\n\"{question}\"\n\n"
        "Return ONLY the title text, nothing else."
    )
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_GENERATIVE_MODEL,
            contents=prompt,
        )
        title = (getattr(response, "text", None) or "").strip().strip("\"'")
        # Guard against unexpectedly long model output
        return title[:120] if title else _fallback_title(question)
    except Exception as exc:
        logger.warning("Failed to generate session title: %s — using fallback.", exc)
        return _fallback_title(question)


def _fallback_title(question: str) -> str:
    """Return the first 60 chars of the question as a best-effort title."""
    q = question.strip()
    return (q[:60] + "…") if len(q) > 60 else q
