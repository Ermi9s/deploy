'''Custom permission classes for UserAccountManager'''
from rest_framework.permissions import BasePermission


class IsOwnerOrSuperuser(BasePermission):
    """
    Allows access only if the requesting user is the owner of the object
    or a superuser.

    Works for both User and Profile objects:
      - For Profile: checks request.user == obj.user
      - For User:    checks request.user == obj
    """

    def has_object_permission(self, request, view, obj):
        # Superusers always have access
        if request.user and request.user.is_superuser:
            return True

        # Determine ownership based on object type
        from UserAccountManager.models import User
        if isinstance(obj, User):
            return request.user == obj
        # For Profile and similar objects with a 'user' FK
        return hasattr(obj, 'user') and request.user == obj.user


class IsSiteAdmin(BasePermission):
    """
    Allows access only to authenticated site administrators (is_superuser=True).
    Applied to all /auth/admin/ endpoints.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )
