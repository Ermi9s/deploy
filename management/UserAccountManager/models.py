'''Defining User and Profile models with soft-delete support, and AuditLog for admin audit trail.'''
from django.core.exceptions import ValidationError
from django.db import models
from uuid import uuid4
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.validators import validate_email
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.utils import timezone
from UserAccountManager.managers import UserManager, SoftDeleteManager, AllObjectsManager


class TimeStampMixin(models.Model):
    """Adds created_at and updated_at timestamps."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Department(TimeStampMixin):
    """
    Represents an organisational department (e.g. Engineering, HR).
    Departments are the top-level grouping for the MAC hierarchy.
    """
    uuid = models.UUIDField(
        default=uuid4,
        unique=True,
        editable=False,
        help_text='Stable public identifier used as the key in department_access JSON maps.',
    )
    name = models.CharField(max_length=128, unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class PermissionLevel(TimeStampMixin):
    """
    A named access tier within a Department.
    Higher ranking integers inherit access to all lower-ranked content
    within the same department.  Rankings must be unique per department.
    """
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='permission_levels',
    )
    name = models.CharField(max_length=64, help_text='e.g. "Confidential", "Secret"')
    ranking = models.PositiveSmallIntegerField(
        help_text='Higher value = higher clearance.  Must be unique within its department.'
    )

    class Meta:
        unique_together = [('department', 'ranking')]
        ordering = ['department', 'ranking']

    def __str__(self) -> str:
        return f'{self.department.name} / {self.name} (rank {self.ranking})'


class SoftDeleteMixin(models.Model):
    """
    Mixin that provides soft-delete behaviour.
    Records are marked as deleted instead of being removed from the database.
    """
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Default manager excludes soft-deleted records
    objects = SoftDeleteManager()
    # Secondary manager that includes everything
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """Soft-delete: mark the record instead of actually deleting it."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])


class User(AbstractBaseUser, PermissionsMixin, TimeStampMixin, SoftDeleteMixin):
    '''Custom user model with soft-delete support.'''

    validate_username = UnicodeUsernameValidator()

    uuid = models.UUIDField(unique=True, default=uuid4, editable=False)
    email = models.EmailField(
        max_length=255,
        unique=True,
        validators=[validate_username, validate_email],
    )
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=128, blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    provider = models.CharField(max_length=60, default='local')

    USERNAME_FIELD = EMAIL_FIELD = 'email'

    # Override default manager with soft-delete aware manager
    objects = UserManager()
    all_objects = AllObjectsManager()

    def __str__(self) -> str:
        return self.email

    def delete(self, using=None, keep_parents=False):
        """Soft-delete the user and their profile."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])
        # Also soft-delete the associated profile if it exists
        if hasattr(self, 'profile') and self.profile:
            self.profile.delete()


class Profile(TimeStampMixin, SoftDeleteMixin):
    """
    Extended profile for each user.
    Created automatically when a user is created via UserManager.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    contact_info = models.CharField(max_length=255, blank=True)
    firstname = models.CharField(max_length=60, blank=True)
    lastname = models.CharField(max_length=128, blank=True)
    emergency_contact_name = models.CharField(max_length=128, blank=True)
    emergency_number = models.CharField(max_length=20, blank=True)
    profile_pic = models.ImageField(
        upload_to='profile_pics/',
        null=True,
        blank=True,
    )
    address = models.TextField(blank=True)

    # --- MAC fields ---
    department = models.ForeignKey(
        'Department',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='members',
        help_text='The organisational department this user belongs to.',
    )
    permission_level = models.ForeignKey(
        'PermissionLevel',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='members',
        help_text='The access tier assigned to this user within their department.',
    )

    def clean(self):
        """Ensure the assigned permission level belongs to the user's department."""
        if self.permission_level_id and self.department_id:
            if self.permission_level.department_id != self.department_id:
                raise ValidationError(
                    {'permission_level': 'Permission level must belong to the user\'s department.'}
                )

    def __str__(self) -> str:
        return f'Profile of {self.user.email}'


class AuditLog(models.Model):
    """
    Immutable record of every admin action performed via the Admin UI.
    Written by admin_views helpers; never updated or soft-deleted.
    """
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('ASSIGN', 'Assign'),
        ('ROLE_TOGGLE', 'Role Toggle'),
    ]
    TARGET_CHOICES = [
        ('DEPARTMENT', 'Department'),
        ('PERMISSION_LEVEL', 'Permission Level'),
        ('USER', 'User'),
    ]

    actor = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='admin_actions',
        help_text='The admin user who performed this action.',
    )
    action_type = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        db_index=True,
    )
    target_type = models.CharField(
        max_length=30,
        choices=TARGET_CHOICES,
        db_index=True,
        help_text='The model that was modified.',
    )
    target_id = models.CharField(
        max_length=128,
        help_text='Primary key or UUID of the affected object.',
    )
    details = models.JSONField(
        default=dict,
        help_text='Before/after diff or human-readable change description.',
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self) -> str:
        actor_email = self.actor.email if self.actor_id else 'system'
        return f'[{self.timestamp:%Y-%m-%d %H:%M}] {actor_email} {self.action_type} {self.target_type} {self.target_id}'
