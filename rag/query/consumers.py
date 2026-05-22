"""
WebSocket consumer for the RAG chat endpoint — with server-side DB persistence.

Authentication: JWT via Sec-WebSocket-Protocol header (browser workaround).

On every query the consumer:
  1. Validates the JWT and extracts user_id, department_id, permission_ranking.
  2. Looks up the ChatSession in PostgreSQL (must belong to the caller).
  3. Seeds the Redis context window from the DB if the Redis key is absent.
  4. Saves the user message to ChatMessage immediately.
  5. Runs the full RAG pipeline (embed → retrieve → generate stream).
  6. On first message in a session, asks Gemini to generate a session title,
     saves it to the DB, and sends a `session_title` WS frame to the client.
  7. Saves the full assistant message to ChatMessage once streaming completes.
  8. Appends the pair to the Redis context window for future queries.

Incoming message format:
    {"type": "query", "question": "...", "session_id": "uuid"}

Outgoing message formats:
    {"type": "token",         "content": "word "}
    {"type": "sources",       "sources": [{document_id, chunk_id, filename, score}]}
    {"type": "session_title", "session_id": "uuid", "title": "Generated Title"}
    {"type": "done"}
    {"type": "error",         "message": "..."}
"""
from __future__ import annotations

import json
import logging

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from . import memory
from .services import (
    async_generate_session_title,
    build_chat_messages,
    async_embed_query,
    async_generate_answer_stream,
    retrieve_chunks,
)

logger = logging.getLogger(__name__)

_GEMINI_OVERLOAD_MSG = (
    "⚠️ The AI model is currently experiencing high demand. "
    "Your documents were retrieved successfully, but generating a response failed. "
    "Please try again in a moment."
)

_EMBED_FAILURE_MSG = (
    "⚠️ Could not embed your question due to a temporary API issue. "
    "Please try again shortly."
)


class ChatConsumer(AsyncWebsocketConsumer):
    """Streaming RAG chat WebSocket consumer with PostgreSQL-backed persistence."""

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self) -> None:
        """
        Validate the JWT from the Sec-WebSocket-Protocol header.
        Extracts: user_id, department_id, permission_ranking.
        """
        subprotocols: list[str] = self.scope.get("subprotocols", [])
        token_str: str | None = None

        if len(subprotocols) >= 2 and subprotocols[0] == "access_token":
            token_str = subprotocols[1]

        if not token_str:
            logger.warning("WebSocket connection rejected: no token in subprotocols")
            await self.close(code=4001)
            return

        try:
            token = AccessToken(token_str)
            self.user_id: int = int(token.payload.get("user_id", 0))
            self.department_id: str | None = token.payload.get("department_id")
            self.permission_ranking: int | None = token.payload.get("permission_ranking")
        except TokenError as exc:
            logger.warning("WebSocket connection rejected: invalid JWT — %s", exc)
            await self.close(code=4001)
            return

        if not self.user_id:
            logger.warning("WebSocket connection rejected: user_id missing from token")
            await self.close(code=4001)
            return

        await self.accept(subprotocol="access_token")
        logger.info(
            "Chat WebSocket connected — user_id=%s dept=%s rank=%s",
            self.user_id, self.department_id, self.permission_ranking,
        )

    async def disconnect(self, close_code: int) -> None:
        logger.debug("Chat WebSocket disconnected — code=%s", close_code)

    # ------------------------------------------------------------------
    # Message handling
    # ------------------------------------------------------------------

    async def receive(self, text_data: str) -> None:  # type: ignore[override]
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error("Invalid JSON payload.")
            return

        if payload.get("type") != "query":
            await self._send_error("Unknown message type. Expected 'query'.")
            return

        question: str = (payload.get("question") or "").strip()
        session_id: str = (payload.get("session_id") or "").strip()

        if not question:
            await self._send_error("Question must not be empty.")
            return

        if not session_id:
            await self._send_error("session_id is required.")
            return

        try:
            await self._handle_query(question, session_id)
        except Exception:
            logger.exception("Unhandled error in ChatConsumer for session %s", session_id)
            await self._send_error("An internal error occurred. Please try again.")

    # ------------------------------------------------------------------
    # RAG pipeline
    # ------------------------------------------------------------------

    async def _handle_query(self, question: str, session_id: str) -> None:
        # 1. Look up the session — must belong to this user
        session = await sync_to_async(self._get_session)(session_id)
        if session is None:
            await self._send_error("Session not found or access denied.")
            return

        # 2. Seed Redis from DB if the context window is gone (e.g. after Redis restart)
        await sync_to_async(memory.seed_from_db)(session_id)

        # 3. Load the Redis context window for the RAG pipeline
        history: list[dict] = await sync_to_async(memory.get_history)(session_id)

        # 4. Save user message to DB immediately (before the slow RAG pipeline)
        await sync_to_async(self._save_message)(session, "user", question, [])

        # 5. Embed the query
        try:
            query_vector: list[float] = await async_embed_query(question)
        except Exception as exc:
            logger.error("Embedding failed for session %s: %s", session_id, exc)
            await self._send_token(_EMBED_FAILURE_MSG)
            await self._send_done()
            return

        # 6. Retrieve permission-filtered chunks
        try:
            chunks: list[dict] = await sync_to_async(retrieve_chunks)(
                query_vector,
                department_id=self.department_id,
                permission_ranking=self.permission_ranking,
            )
        except Exception as exc:
            logger.error("Elasticsearch retrieval failed for session %s: %s", session_id, exc)
            await self._send_error("Document retrieval failed. Please try again.")
            return

        if not chunks:
            await self._send_token(
                "I could not find any relevant documents in the knowledge base "
                "that you are authorised to access."
            )
            await self._send_done()
            return

        # 7. Build the full messages array (system + history + context + question)
        messages = build_chat_messages(question, chunks, history)

        # 8. Stream tokens back to the client
        full_answer_parts: list[str] = []
        try:
            async for token_text in async_generate_answer_stream(messages):
                full_answer_parts.append(token_text)
                await self._send_token(token_text)
        except Exception as exc:
            logger.error(
                "Gemini streaming failed for session %s after all retries: %s",
                session_id, exc,
            )
            if full_answer_parts:
                await self._send_token(
                    "\n\n⚠️ The response was cut short due to a temporary AI model issue. "
                    "Please try again."
                )
            else:
                await self._send_token(_GEMINI_OVERLOAD_MSG)
            await self._send_done()
            return

        if not full_answer_parts:
            await self._send_token(
                "The model returned an empty response. "
                "Please rephrase your question and try again."
            )
            await self._send_done()
            return

        full_answer = "".join(full_answer_parts)

        # 9. Deduplicate and send source citations
        seen_document_ids: set[str] = set()
        deduped_sources: list[dict] = []
        for c in chunks:
            doc_id = c.get("document_id", "")
            if doc_id and doc_id in seen_document_ids:
                continue
            seen_document_ids.add(doc_id)
            deduped_sources.append({
                "document_id": doc_id,
                "chunk_id": c.get("chunk_id", ""),
                "filename": c.get("filename", ""),
                "score": round(c.get("score", 0.0), 4),
            })
        await self.send(text_data=json.dumps({"type": "sources", "sources": deduped_sources}))

        # 10. Save assistant message to DB
        await sync_to_async(self._save_message)(session, "assistant", full_answer, deduped_sources)

        # 11. If this is the first message, auto-generate a title with Gemini
        is_first_message = await sync_to_async(self._is_first_exchange)(session)
        if is_first_message and session.title in ("New Conversation", ""):
            title = await async_generate_session_title(question)
            await sync_to_async(self._set_session_title)(session, title)
            await self.send(text_data=json.dumps({
                "type": "session_title",
                "session_id": str(session.id),
                "title": title,
            }))

        # 12. Signal completion
        await self._send_done()

        # 13. Append to Redis context window (fire-and-forget)
        await sync_to_async(memory.append_pair)(session_id, question, full_answer)

    # ------------------------------------------------------------------
    # DB helpers (called via sync_to_async)
    # ------------------------------------------------------------------

    def _get_session(self, session_id: str):
        """Return the ChatSession if it exists and belongs to self.user_id, else None."""
        from .models import ChatSession  # noqa: PLC0415
        try:
            return ChatSession.objects.get(id=session_id, user_id=self.user_id, is_deleted=False)
        except ChatSession.DoesNotExist:
            return None

    def _save_message(self, session, role: str, content: str, sources: list) -> None:
        """Persist a single ChatMessage to PostgreSQL."""
        from .models import ChatMessage  # noqa: PLC0415
        ChatMessage.objects.create(
            session=session,
            role=role,
            content=content,
            sources=sources,
        )
        # Touch updated_at on the parent session
        from django.utils import timezone  # noqa: PLC0415
        session.updated_at = timezone.now()
        session.save(update_fields=["updated_at"])

    def _is_first_exchange(self, session) -> bool:
        """Return True when the session now has exactly one user + one assistant message."""
        from .models import ChatMessage  # noqa: PLC0415
        return ChatMessage.objects.filter(session=session).count() == 2

    def _set_session_title(self, session, title: str) -> None:
        """Update session title in the DB."""
        session.title = title
        session.save(update_fields=["title", "updated_at"])

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _send_token(self, content: str) -> None:
        await self.send(text_data=json.dumps({"type": "token", "content": content}))

    async def _send_done(self) -> None:
        await self.send(text_data=json.dumps({"type": "done"}))

    async def _send_error(self, message: str) -> None:
        await self.send(text_data=json.dumps({"type": "error", "message": message}))
