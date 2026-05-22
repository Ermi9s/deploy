from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class DriveItem(models.Model):
    class ItemType(models.TextChoices):
        FILE = 'file', 'File'
        FOLDER = 'folder', 'Folder'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='drive_items')
    name = models.CharField(max_length=255)
    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    mime_type = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    storage_path = models.CharField(max_length=1024, blank=True)
    source_document_id = models.UUIDField(null=True, blank=True, unique=True)
    task_id = models.CharField(max_length=255, blank=True)
    is_trashed = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # MAC: maps Department UUID (str) → minimum integer ranking required for access.
    # Example: {"<dept-uuid>": 3, "<dept-uuid-2>": 1}
    # An empty dict means no department restrictions have been applied.
    department_access = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'Access control matrix. Keys are Department UUIDs (strings), '
            'values are the minimum ranking integer required for that department. '
            'A department absent from this map has no access.'
        ),
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner', 'parent', 'is_trashed']),
            models.Index(fields=['owner', 'item_type', 'is_trashed']),
        ]

    def __str__(self) -> str:
        return f'{self.name} ({self.item_type})'

    def trash(self):
        if not self.is_trashed:
            self.is_trashed = True
            self.deleted_at = timezone.now()
            self.save(update_fields=['is_trashed', 'deleted_at', 'updated_at'])

    def restore(self):
        if self.is_trashed:
            self.is_trashed = False
            self.deleted_at = None
            self.save(update_fields=['is_trashed', 'deleted_at', 'updated_at'])

class FileVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    drive_item = models.ForeignKey(DriveItem, on_delete=models.CASCADE, related_name='versions')
    storage_key = models.CharField(max_length=1024)
    version = models.PositiveIntegerField()
    size = models.PositiveBigIntegerField()
    checksum = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        unique_together = [('drive_item', 'version')]

