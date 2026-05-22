"""
Management command: purge_old_sessions

Soft-deletes ChatSession records whose `updated_at` timestamp is older than
CHAT_SESSION_RETENTION_DAYS (default 7) days.

Usage:
    python manage.py purge_old_sessions

Schedule via cron or a Celery beat task to run daily, e.g.:
    0 2 * * * docker exec rag python manage.py purge_old_sessions
"""
from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Soft-delete chat sessions older than CHAT_SESSION_RETENTION_DAYS days."

    def handle(self, *args, **options) -> None:
        retention_days: int = getattr(settings, "CHAT_SESSION_RETENTION_DAYS", 7)
        cutoff = timezone.now() - timedelta(days=retention_days)

        from query.models import ChatSession  # noqa: PLC0415 — avoids top-level import issue

        qs = ChatSession.objects.filter(
            updated_at__lt=cutoff,
            is_deleted=False,
        )
        count = qs.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No sessions to purge."))
            return

        now = timezone.now()
        qs.update(is_deleted=True, deleted_at=now)

        self.stdout.write(
            self.style.SUCCESS(
                f"Purged {count} session(s) older than {retention_days} day(s) "
                f"(cutoff: {cutoff.isoformat()})."
            )
        )
