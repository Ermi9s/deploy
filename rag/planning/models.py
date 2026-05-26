"""
Database models for the Planning feature.

Plan         — a department-scoped collection of milestones.
Milestone    — a single measurable goal within a Plan.
PlanningNotification — in-app notification for plan owners when a milestone
                       is auto-completed.
"""
from __future__ import annotations

from uuid import uuid4

from django.db import models
from django.utils import timezone


class Plan(models.Model):
    """A set of milestones owned by one department."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # department_id and created_by_user_id are copied from the JWT at creation
    # time — no cross-service DB join is required at query time.
    department_id = models.CharField(max_length=100, db_index=True)
    created_by_user_id = models.PositiveIntegerField(db_index=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['department_id', 'is_active']),
        ]

    def __str__(self) -> str:
        return f'Plan({self.id}) dept={self.department_id} — {self.title[:60]}'


class Milestone(models.Model):
    """A single measurable goal within a Plan."""

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        AUTO_COMPLETED = 'auto_completed', 'Auto Completed'
        MANUALLY_COMPLETED = 'manually_completed', 'Manually Completed'

    class Confidence(models.TextChoices):
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='milestones')

    title = models.CharField(max_length=255)
    # Officers should write precise, measurable descriptions — the AI checks
    # document content against this field.
    description = models.TextField()
    due_date = models.DateField(null=True, blank=True)

    # --- Completion state ---
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    # AI-generated summary explaining how the document satisfies this milestone.
    completion_summary = models.TextField(blank=True)
    # Confidence score returned by Gemini ('high', 'medium', 'low').
    completion_confidence = models.CharField(
        max_length=10, choices=Confidence.choices, blank=True
    )
    # The document that triggered auto-completion.
    reference_document_id = models.CharField(max_length=255, blank=True)
    reference_filename = models.CharField(max_length=512, blank=True)

    # --- Rejection tracking ---
    # List of document_id strings whose AI completions were rejected by the
    # plan owner. The same document will never re-trigger this milestone.
    rejected_document_ids = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['plan', 'status']),
        ]

    def __str__(self) -> str:
        return f'Milestone({self.id}) [{self.status}] — {self.title[:60]}'

    @property
    def is_completed(self) -> bool:
        return self.status in (
            self.Status.AUTO_COMPLETED,
            self.Status.MANUALLY_COMPLETED,
        )

    def mark_auto_complete(
        self,
        document_id: str,
        filename: str,
        summary: str,
        confidence: str,
    ) -> None:
        """Transition milestone to AUTO_COMPLETED and save."""
        self.status = self.Status.AUTO_COMPLETED
        self.completed_at = timezone.now()
        self.completion_summary = summary
        self.completion_confidence = confidence
        self.reference_document_id = document_id
        self.reference_filename = filename
        self.save(update_fields=[
            'status', 'completed_at', 'completion_summary',
            'completion_confidence', 'reference_document_id',
            'reference_filename', 'updated_at',
        ])

    def reject_completion(self) -> None:
        """
        Revert to OPEN.  The document that was used to auto-complete is added
        to rejected_document_ids so it can never re-trigger this milestone.
        """
        doc_id = self.reference_document_id
        if doc_id and doc_id not in self.rejected_document_ids:
            self.rejected_document_ids = list(self.rejected_document_ids) + [doc_id]

        self.status = self.Status.OPEN
        self.completed_at = None
        self.completion_summary = ''
        self.completion_confidence = ''
        self.reference_document_id = ''
        self.reference_filename = ''
        self.save(update_fields=[
            'status', 'completed_at', 'completion_summary',
            'completion_confidence', 'reference_document_id',
            'reference_filename', 'rejected_document_ids', 'updated_at',
        ])

    def mark_manually_complete(self) -> None:
        """Officer manually marks this milestone as complete."""
        self.status = self.Status.MANUALLY_COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at', 'updated_at'])


class PlanningNotification(models.Model):
    """
    In-app notification sent to a plan owner when a milestone is auto-completed.

    The frontend polls GET /api/planning/notifications/ to surface these.
    """

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    # Recipient: the plan's created_by_user_id (integer PK from management service).
    user_id = models.PositiveIntegerField(db_index=True)
    milestone = models.ForeignKey(
        Milestone, on_delete=models.CASCADE, related_name='notifications'
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'is_read']),
        ]

    def __str__(self) -> str:
        return f'Notification(user={self.user_id}, milestone={self.milestone_id}, read={self.is_read})'
