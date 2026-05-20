"""post_migrate signal to seed the default 'Public' Department and PermissionLevel.

This runs automatically after every `migrate` command. Using get_or_create makes
it fully idempotent — safe to run on every deploy or restart.
"""
from django.db.models.signals import post_migrate
from django.dispatch import receiver


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
        import logging
        logging.getLogger(__name__).info('MAC seed: created Public department (uuid=%s)', public_dept.uuid)

    PermissionLevel.objects.get_or_create(
        department=public_dept,
        ranking=1,
        defaults={'name': 'Public'},
    )
