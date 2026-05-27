"""
Shared read/write ORM models for the Report Generation module.

These models MIRROR the tables created by the RAG service's `report` app.
The workers service MUST NOT run makemigrations/migrate for this app —
the RAG service owns the schema. This app exists solely so the Celery
worker can do ORM reads and writes against the shared PostgreSQL database.
"""
from __future__ import annotations

from uuid import uuid4

from django.db import models


class ReportJob(models.Model):
    """Mirrors rag_service.report.models.ReportJob — same table, same columns."""

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
    user_id = models.PositiveIntegerField(db_index=True)
    title = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    final_report = models.TextField(blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    department_id = models.CharField(max_length=255, null=True, blank=True)
    permission_ranking = models.IntegerField(null=True, blank=True)
    drive_item_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Must point at the exact table created by the RAG service migration.
        app_label = "rag_report"
        db_table = "rag_report_reportjob"
        managed = False  # workers service never runs migrations for this table
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ReportJob({self.id}) user={self.user_id} — {self.title[:40]}"


class ReportAgenda(models.Model):
    """Mirrors rag_service.report.models.ReportAgenda — same table, same columns."""

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
    job = models.ForeignKey(
        ReportJob, on_delete=models.CASCADE, related_name="agendas"
    )
    order = models.PositiveSmallIntegerField()
    text = models.TextField()
    sub_report = models.TextField(blank=True, default="")
    sources = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )

    class Meta:
        app_label = "rag_report"
        db_table = "rag_report_reportagenda"
        managed = False  # workers service never runs migrations for this table
        ordering = ["order"]
        unique_together = [("job", "order")]

    def __str__(self) -> str:
        return f"Agenda({self.order}): {self.text[:60]}"
