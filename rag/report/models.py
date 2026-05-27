"""
Database models for the Report Generation module.

ReportJob   — a single report request, owned by one user.
ReportAgenda — individual agenda items within a job.
"""
from __future__ import annotations

from uuid import uuid4

from django.db import models
from django.utils import timezone


class ReportJob(models.Model):
    """Represents a full report generation job (scatter-gather pipeline)."""

    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    # The integer PK of the User in the management service — from JWT claim 'user_id'.
    user_id = models.PositiveIntegerField(db_index=True)

    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)

    # Populated on completion
    final_report = models.TextField(blank=True, default="")

    # Populated on failure
    error_message = models.TextField(blank=True, default="")

    # MAC context — copied from the JWT at creation time and embedded into the
    # Celery task payload so the worker enforces access control on ES retrieval.
    department_id = models.CharField(max_length=255, null=True, blank=True)
    permission_ranking = models.IntegerField(null=True, blank=True)

    # Set after "Store to Drive" action
    drive_item_id = models.CharField(max_length=255, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user_id", "status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"ReportJob({self.id}) user={self.user_id} — {self.title[:40]}"


class ReportAgenda(models.Model):
    """One agenda item within a ReportJob."""

    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    job = models.ForeignKey(ReportJob, on_delete=models.CASCADE, related_name="agendas")
    order = models.PositiveSmallIntegerField()
    text = models.TextField()

    # Populated by the Celery worker
    sub_report = models.TextField(blank=True, default="")
    sources = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    class Meta:
        ordering = ["order"]
        unique_together = [("job", "order")]

    def __str__(self) -> str:
        return f"Agenda({self.order}): {self.text[:60]}"
