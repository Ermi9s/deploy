"""
Serializers for the persistent chat history REST API.

ChatSessionSerializer  — used for session list / create / update responses.
ChatMessageSerializer  — used for message list responses.
"""
from __future__ import annotations

from rest_framework import serializers

from .models import ChatMessage, ChatSession


class ChatSessionSerializer(serializers.ModelSerializer):
    """Serializer for ChatSession — omits user_id (derived from JWT, never trusted from client)."""

    class Meta:
        model = ChatSession
        fields = ["id", "title", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for ChatMessage — read-only (messages are written by the WS consumer)."""

    class Meta:
        model = ChatMessage
        fields = ["id", "session_id", "role", "content", "sources", "created_at"]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Query (existing) serializers — kept here to consolidate serializer module
# ---------------------------------------------------------------------------

class QueryRequestSerializer(serializers.Serializer):
    """Schema for the synchronous POST /api/query/ endpoint."""
    question = serializers.CharField(min_length=1, max_length=4096)
    top_k = serializers.IntegerField(min_value=1, max_value=20, required=False)


class SourceSerializer(serializers.Serializer):
    document_id = serializers.CharField()
    chunk_id = serializers.CharField()
    filename = serializers.CharField()
    score = serializers.FloatField()


class QueryResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    sources = SourceSerializer(many=True)
