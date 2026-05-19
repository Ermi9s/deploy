import uuid

from django.db import models


class UploadedDocument(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_filename = models.CharField(max_length=512)
    mime_type = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=1024)
    task_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)
    stage = models.CharField(max_length=100, blank=True)
    error_message = models.TextField(blank=True)
    # MAC: mirrors the DriveItem permission matrix {"<dept-uuid>": <min_ranking_int>}
    department_access = models.JSONField(
        default=dict,
        blank=True,
        help_text='Access control matrix forwarded from the management DriveItem.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.id} ({self.status})'
