"""
REST API views for the persistent chat history.

Endpoints:
  GET  /api/chat/sessions/              — paginated list of the caller's sessions
  POST /api/chat/sessions/              — create a new empty session
  PATCH /api/chat/sessions/{id}/        — rename a session
  DELETE /api/chat/sessions/{id}/       — soft-delete a session
  GET  /api/chat/sessions/{id}/messages/ — list all messages in a session

All endpoints require a valid JWT (IsAuthenticated).
The user_id is always taken from request.auth.payload, never from the client.
"""
from __future__ import annotations

import logging

from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatMessage, ChatSession
from .serializers import (
    ChatMessageSerializer,
    ChatSessionSerializer,
    QueryRequestSerializer,
    QueryResponseSerializer,
)
from .services import (
    build_rag_prompt,
    embed_query,
    generate_answer,
    retrieve_chunks,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class SessionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _user_id_from_request(request) -> int:
    """Extract user_id integer from the decoded JWT payload."""
    return int(getattr(request.auth, "payload", {}).get("user_id", 0))


# ---------------------------------------------------------------------------
# Session Views
# ---------------------------------------------------------------------------

class ChatSessionListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="List chat sessions",
        description="Returns the authenticated user's chat sessions ordered by most recently updated. Paginated.",
        responses={200: ChatSessionSerializer(many=True)},
    )
    def get(self, request):
        user_id = _user_id_from_request(request)
        qs = ChatSession.objects.filter(user_id=user_id, is_deleted=False)

        paginator = SessionPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ChatSessionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        summary="Create a chat session",
        description="Create a new empty session. The server generates the UUID.",
        request=None,
        responses={201: ChatSessionSerializer},
    )
    def post(self, request):
        user_id = _user_id_from_request(request)
        if not user_id:
            return Response({"detail": "Could not resolve user from token."}, status=status.HTTP_401_UNAUTHORIZED)

        session = ChatSession.objects.create(user_id=user_id, title="New Conversation")
        return Response(ChatSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class ChatSessionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_session(self, pk, user_id):
        try:
            return ChatSession.objects.get(id=pk, user_id=user_id, is_deleted=False)
        except ChatSession.DoesNotExist:
            return None

    @extend_schema(
        summary="Rename a session",
        request=ChatSessionSerializer,
        responses={
            200: ChatSessionSerializer,
            404: OpenApiResponse(description="Session not found"),
        },
    )
    def patch(self, request, pk):
        user_id = _user_id_from_request(request)
        session = self._get_session(pk, user_id)
        if not session:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        title = (request.data.get("title") or "").strip()
        if not title:
            return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)

        session.title = title[:255]
        session.save(update_fields=["title", "updated_at"])
        return Response(ChatSessionSerializer(session).data)

    @extend_schema(
        summary="Delete a session",
        responses={
            204: OpenApiResponse(description="Session soft-deleted"),
            404: OpenApiResponse(description="Session not found"),
        },
    )
    def delete(self, request, pk):
        user_id = _user_id_from_request(request)
        session = self._get_session(pk, user_id)
        if not session:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        session.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Message Views
# ---------------------------------------------------------------------------

class ChatMessageListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="List messages in a session",
        description="Returns all messages for the given session, oldest first.",
        responses={
            200: ChatMessageSerializer(many=True),
            404: OpenApiResponse(description="Session not found"),
        },
    )
    def get(self, request, pk):
        user_id = _user_id_from_request(request)
        try:
            session = ChatSession.objects.get(id=pk, user_id=user_id, is_deleted=False)
        except ChatSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        messages = ChatMessage.objects.filter(session=session)
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Synchronous query view (existing — kept for completeness)
# ---------------------------------------------------------------------------

class QueryAPIView(APIView):
    # Require a valid JWT; MAC claims embedded in the token are used to
    # filter the vector search to only chunks the user is authorised to see.
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Ask a question",
        description="Submit a natural-language question. The system retrieves "
                    "relevant document chunks the requesting user is authorised "
                    "to access and generates an answer.",
        request=QueryRequestSerializer,
        responses={
            200: QueryResponseSerializer,
            400: OpenApiResponse(description="Invalid request"),
            500: OpenApiResponse(description="Internal pipeline error"),
        },
    )
    def post(self, request):
        serializer = QueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data["question"]
        top_k = serializer.validated_data.get("top_k")

        # --- MAC: extract department context from the decoded JWT payload ---
        token_payload = getattr(request.auth, "payload", {})
        department_id = token_payload.get("department_id")
        permission_ranking = token_payload.get("permission_ranking")

        try:
            query_vector = embed_query(question)
            chunks = retrieve_chunks(
                query_vector,
                top_k=top_k,
                department_id=department_id,
                permission_ranking=permission_ranking,
            )

            if not chunks:
                return Response(
                    QueryResponseSerializer({
                        "answer": "No relevant documents found in the knowledge base.",
                        "sources": [],
                    }).data,
                    status=status.HTTP_200_OK,
                )

            prompt = build_rag_prompt(question, chunks)
            answer = generate_answer(prompt)

            return Response(
                QueryResponseSerializer({"answer": answer, "sources": chunks}).data,
                status=status.HTTP_200_OK,
            )

        except Exception:
            logger.exception("RAG pipeline failed for question: %s", question)
            return Response(
                {"error": "An internal error occurred while processing your question."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
