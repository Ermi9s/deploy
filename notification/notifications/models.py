from __future__ import annotations

import uuid

from django.db import models


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.PositiveIntegerField(db_index=True)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    notification_type = models.CharField(max_length=64, default='generic', db_index=True)

    milestone_id = models.UUIDField(null=True, blank=True)
    milestone_title = models.CharField(max_length=255, blank=True)
    milestone_status = models.CharField(max_length=32, blank=True)
    plan_id = models.UUIDField(null=True, blank=True)
    plan_title = models.CharField(max_length=255, blank=True)
    reference_document_id = models.CharField(max_length=255, blank=True)
    reference_filename = models.CharField(max_length=512, blank=True)
    reference_mac_ranking = models.PositiveSmallIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'is_read']),
        ]

    def __str__(self) -> str:
        return f'Notification(user={self.user_id}, type={self.notification_type}, read={self.is_read})'
