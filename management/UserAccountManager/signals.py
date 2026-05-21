"""post_migrate signal to seed the default 'Public' Department, PermissionLevel,
and an initial site admin account (from ADMIN_EMAIL / ADMIN_PASSWORD env vars).

All operations are idempotent — safe to run on every deploy or restart.
"""
import os
import logging

from django.db.models.signals import post_migrate
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_migrate)
def seed_public_department(sender, **kwargs):
    """Ensure a 'Public' Department with a base ranking-1 PermissionLevel always exists."""
    if sender.name != 'UserAccountManager':
        return

    # Import here to avoid AppRegistryNotReady errors at module load time.
    from .models import Department, PermissionLevel

    public_dept, created = Department.objects.get_or_create(
        name='Public',
        defaults={},
    )
    if created:
        logger.info('MAC seed: created Public department (uuid=%s)', public_dept.uuid)

    PermissionLevel.objects.get_or_create(
        department=public_dept,
        ranking=1,
        defaults={'name': 'Public'},
    )


@receiver(post_migrate)
def seed_initial_admin(sender, **kwargs):
    """Create an initial superuser from ADMIN_EMAIL / ADMIN_PASSWORD env vars.

    Only runs if:
      - The sender is the UserAccountManager app.
      - ADMIN_EMAIL and ADMIN_PASSWORD are set in the environment.
      - No superuser exists yet (first-time setup only).
    """
    if sender.name != 'UserAccountManager':
        return

    admin_email = os.getenv('ADMIN_EMAIL', '').strip()
    admin_password = os.getenv('ADMIN_PASSWORD', '').strip()

    if not admin_email or not admin_password:
        return  # env vars not set — skip silently

    from .models import User

    if User.objects.filter(is_superuser=True).exists():
        return  # a superuser already exists — skip

    try:
        user = User.objects.create_superuser(
            email=admin_email,
            password=admin_password,
        )
        logger.info('Admin seed: created initial superuser (%s)', user.email)
    except Exception:
        logger.exception('Admin seed: failed to create initial superuser.')
