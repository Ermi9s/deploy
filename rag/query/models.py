"""
Database models for persistent chat history.

ChatSession  — one session per user conversation thread.
ChatMessage  — individual user / assistant messages within a session.

The `user_id` field stores the integer PK of the user from the management
service, extracted directly from the JWT claim `user_id` (SimpleJWT default).
No cross-service database join is needed at query time.
"""
from __future__ import annotations

from uuid import uuid4

from django.db import models
from django.utils import timezone


class ChatSession(models.Model):
    """A single conversation thread owned by one user."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    # The integer PK of the User in the management service, from JWT claim 'user_id'.
    user_id = models.PositiveIntegerField(db_index=True)
    title = models.CharField(max_length=255, default="New Conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user_id", "is_deleted", "-updated_at"]),
        ]

    def __str__(self) -> str:
        return f"Session({self.id}) user={self.user_id} — {self.title[:40]}"

    def soft_delete(self) -> None:
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])


class ChatMessage(models.Model):
    """A single message (user or assistant) within a ChatSession."""

    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_ASSISTANT, "Assistant"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    # Source citations attached to assistant messages — stored as a JSON list.
    sources = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session", "created_at"]),
        ]

    def __str__(self) -> str:
        preview = self.content[:60].replace("\n", " ")
        return f"[{self.role}] {preview}"
