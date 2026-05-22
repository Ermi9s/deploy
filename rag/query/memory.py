"""
Redis-backed short-term chat memory.

Each session is stored under key: ``chat_history:{session_id}``
as a JSON-encoded list of message dicts:
    [{"role": "user"|"model", "content": "..."},  ...]

A maximum of ``CHAT_HISTORY_MAX_PAIRS`` user+model pairs are kept
(i.e. up to 2 × MAX_PAIRS entries).  The TTL is reset on every write.
"""
from __future__ import annotations

import json
import logging

import redis as redis_lib
from django.conf import settings

logger = logging.getLogger(__name__)

_redis_client: redis_lib.Redis | None = None


def _get_client() -> redis_lib.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_lib.from_url(
            getattr(settings, "REDIS_URL", "redis://redis:6379/0"),
            decode_responses=True,
        )
    return _redis_client


def _key(session_id: str) -> str:
    return f"chat_history:{session_id}"


def get_history(session_id: str) -> list[dict]:
    """Return the stored message list for *session_id* (may be empty)."""
    try:
        raw = _get_client().get(_key(session_id))
        if raw:
            return json.loads(raw)
    except Exception:
        logger.exception("Failed to read chat history for session %s", session_id)
    return []


def append_pair(session_id: str, user_content: str, model_content: str) -> None:
    """
    Append a user+model message pair to history and trim to the last
    ``CHAT_HISTORY_MAX_PAIRS`` pairs.  Refreshes the TTL on each call.
    """
    max_pairs: int = getattr(settings, "CHAT_HISTORY_MAX_PAIRS", 5)
    ttl: int = getattr(settings, "CHAT_HISTORY_TTL", 3600)

    try:
        client = _get_client()
        key = _key(session_id)

        history: list[dict] = get_history(session_id)
        history.append({"role": "user", "content": user_content})
        history.append({"role": "model", "content": model_content})

        # Keep only the last N pairs (2*N messages)
        max_messages = max_pairs * 2
        if len(history) > max_messages:
            history = history[-max_messages:]

        client.set(key, json.dumps(history), ex=ttl)
    except Exception:
        logger.exception("Failed to append chat history for session %s", session_id)


def clear_history(session_id: str) -> None:
    """Delete the history for *session_id* (e.g. on explicit 'new chat')."""
    try:
        _get_client().delete(_key(session_id))
    except Exception:
        logger.exception("Failed to clear chat history for session %s", session_id)


def seed_from_db(session_id: str) -> None:
    """
    Seed Redis with the conversation history stored in PostgreSQL, but only
    when the Redis key is absent (e.g. after a Redis restart or TTL expiry).

    Imports the ORM models inline to avoid circular imports at module load time.
    """
    try:
        client = _get_client()
        key = _key(session_id)

        # Only seed if the key is genuinely missing
        if client.exists(key):
            return

        from .models import ChatMessage  # noqa: PLC0415 — deferred import
        max_pairs: int = getattr(settings, "CHAT_HISTORY_MAX_PAIRS", 5)
        max_messages = max_pairs * 2

        # Load the last N pairs (user + assistant) ordered by creation time
        qs = (
            ChatMessage.objects
            .filter(session_id=session_id)
            .order_by("-created_at")[:max_messages]
        )
        # Reverse so oldest → newest
        db_messages = list(reversed(list(qs)))

        if not db_messages:
            return

        history = [
            {"role": msg.role if msg.role == "user" else "model", "content": msg.content}
            for msg in db_messages
        ]

        ttl: int = getattr(settings, "CHAT_HISTORY_TTL", 3600)
        client.set(key, json.dumps(history), ex=ttl)
        logger.info("[memory] Seeded Redis for session %s with %d messages from DB", session_id, len(history))
    except Exception:
        logger.exception("Failed to seed Redis from DB for session %s", session_id)
