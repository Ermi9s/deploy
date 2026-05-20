'''Defining managers: UserManager with inline Profile creation, SoftDeleteManager, AllObjectsManager'''
from django.contrib.auth.models import BaseUserManager
from django.db import models


class SoftDeleteManager(models.Manager):
    """Default manager that automatically excludes soft-deleted records."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    """Manager that returns all records including soft-deleted ones."""
    pass


class UserManager(BaseUserManager):
    '''
    Custom user manager that:
      - Creates users with hashed passwords
      - Creates a Profile for each new user inline (no signals)
    '''

    def get_queryset(self):
        """Exclude soft-deleted users by default."""
        return super().get_queryset().filter(is_deleted=False)

    def create(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The given email must be set')

        email = self.normalize_email(email=email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)

        # Create an associated Profile and assign the Public department/level.
        from UserAccountManager.models import Department, PermissionLevel, Profile
        profile = Profile.objects.create(user=user)
        try:
            pub_dept = Department.objects.get(name='Public')
            pub_level = PermissionLevel.objects.get(department=pub_dept, ranking=1)
            profile.department = pub_dept
            profile.permission_level = pub_level
            profile.save(update_fields=['department', 'permission_level'])
        except (Department.DoesNotExist, PermissionLevel.DoesNotExist):
            # Seed data not yet applied (e.g. very first migrate before post_migrate fires).
            # The profile is still created; an admin can assign later.
            pass

        return user

    def create_user(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_superuser', False)

        if extra_fields.get('is_superuser') is True:
            raise ValueError('user must have is_superuser False')

        return self.create(email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_superuser') is False:
            raise ValueError('superuser must have is_superuser True')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('superuser must have is_staff True')

        return self.create(email, password, **extra_fields)