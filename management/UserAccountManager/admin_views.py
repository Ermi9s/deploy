"""Admin API views for the OKM management service.

All views require IsAuthenticated + IsSiteAdmin.
Write operations are wrapped in transaction.atomic() and append an AuditLog entry.
"""
import logging

from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog, Department, PermissionLevel, Profile, User
from .permissions import IsSiteAdmin
from .serializers import (
    AdminDepartmentSerializer,
    AdminPermissionLevelSerializer,
    AdminUserAssignSerializer,
    AdminUserListSerializer,
    AuditLogSerializer,
)

logger = logging.getLogger(__name__)

ADMIN_PERMS = [IsAuthenticated, IsSiteAdmin]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client_ip(request) -> str | None:
    """Extract the real client IP from the request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_admin_action(request, action_type: str, target_type: str, target_id: str, details: dict):
    """Write a single AuditLog row. Called after every successful write operation."""
    try:
        AuditLog.objects.create(
            actor=request.user,
            action_type=action_type,
            target_type=target_type,
            target_id=str(target_id),
            details=details,
            ip_address=_get_client_ip(request),
        )
    except Exception:
        logger.exception('Failed to write AuditLog entry.')


class SmallPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ---------------------------------------------------------------------------
# Dashboard Stats
# ---------------------------------------------------------------------------

class AdminDashboardView(APIView):
    """GET /auth/admin/dashboard/ — summary statistics for the admin home page."""
    permission_classes = ADMIN_PERMS

    def get(self, request):
        recent_logs = AuditLog.objects.select_related('actor').order_by('-timestamp')[:5]
        return Response({
            'total_users': User.objects.filter(is_deleted=False).count(),
            'total_departments': Department.objects.count(),
            'total_clearance_levels': PermissionLevel.objects.count(),
            'recent_audit_logs': AuditLogSerializer(recent_logs, many=True).data,
        })


# ---------------------------------------------------------------------------
# Department CRUD
# ---------------------------------------------------------------------------

class AdminDepartmentListCreateView(APIView):
    """
    GET  /auth/admin/departments/        — list all departments
    POST /auth/admin/departments/        — create a new department
    """
    permission_classes = ADMIN_PERMS

    def get(self, request):
        qs = Department.objects.prefetch_related('permission_levels').order_by('name')
        return Response(AdminDepartmentSerializer(qs, many=True).data)

    def post(self, request):
        serializer = AdminDepartmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Optional: create initial clearance levels in one transaction
        initial_levels = request.data.get('initial_levels', [])

        with transaction.atomic():
            dept = serializer.save()
            for lvl in initial_levels:
                PermissionLevel.objects.create(
                    department=dept,
                    name=lvl.get('name', 'Level'),
                    ranking=lvl.get('ranking', 1),
                )
            log_admin_action(
                request, 'CREATE', 'DEPARTMENT', dept.id,
                {'name': dept.name, 'initial_levels_count': len(initial_levels)},
            )

        dept.refresh_from_db()
        return Response(
            AdminDepartmentSerializer(dept).data,
            status=status.HTTP_201_CREATED,
        )


class AdminDepartmentDetailView(APIView):
    """
    GET    /auth/admin/departments/<pk>/  — retrieve
    PATCH  /auth/admin/departments/<pk>/  — update name
    DELETE /auth/admin/departments/<pk>/  — delete (with integrity check)
    """
    permission_classes = ADMIN_PERMS

    def _get_dept(self, pk):
        try:
            return Department.objects.prefetch_related('permission_levels').get(pk=pk)
        except Department.DoesNotExist:
            return None

    def get(self, request, pk):
        dept = self._get_dept(pk)
        if not dept:
            return Response({'detail': 'Department not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminDepartmentSerializer(dept).data)

    def patch(self, request, pk):
        dept = self._get_dept(pk)
        if not dept:
            return Response({'detail': 'Department not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminDepartmentSerializer(dept, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        old_name = dept.name
        with transaction.atomic():
            updated = serializer.save()
            log_admin_action(
                request, 'UPDATE', 'DEPARTMENT', dept.id,
                {'old_name': old_name, 'new_name': updated.name},
            )
        return Response(AdminDepartmentSerializer(updated).data)

    def delete(self, request, pk):
        dept = self._get_dept(pk)
        if not dept:
            return Response({'detail': 'Department not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Integrity check — block deletion if users are assigned
        linked_users = Profile.objects.filter(department=dept, is_deleted=False).count()
        if linked_users:
            return Response(
                {
                    'detail': (
                        f'Cannot delete: {linked_users} user(s) are assigned to this department. '
                        'Re-assign them first.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        dept_name = dept.name
        with transaction.atomic():
            dept.delete()
            log_admin_action(
                request, 'DELETE', 'DEPARTMENT', pk,
                {'name': dept_name},
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Clearance Level CRUD (nested under department)
# ---------------------------------------------------------------------------

class AdminPermissionLevelListCreateView(APIView):
    """
    GET  /auth/admin/departments/<dept_pk>/permission-levels/
    POST /auth/admin/departments/<dept_pk>/permission-levels/
    """
    permission_classes = ADMIN_PERMS

    def _get_dept(self, dept_pk):
        try:
            return Department.objects.get(pk=dept_pk)
        except Department.DoesNotExist:
            return None

    def get(self, request, dept_pk):
        dept = self._get_dept(dept_pk)
        if not dept:
            return Response({'detail': 'Department not found.'}, status=status.HTTP_404_NOT_FOUND)
        levels = dept.permission_levels.order_by('ranking')
        return Response(AdminPermissionLevelSerializer(levels, many=True).data)

    def post(self, request, dept_pk):
        dept = self._get_dept(dept_pk)
        if not dept:
            return Response({'detail': 'Department not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminPermissionLevelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Check ranking uniqueness within this department
        ranking = serializer.validated_data['ranking']
        if dept.permission_levels.filter(ranking=ranking).exists():
            return Response(
                {'detail': f'A clearance level with ranking {ranking} already exists in this department.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            level = serializer.save(department=dept)
            log_admin_action(
                request, 'CREATE', 'PERMISSION_LEVEL', level.id,
                {'department': dept.name, 'name': level.name, 'ranking': level.ranking},
            )
        return Response(AdminPermissionLevelSerializer(level).data, status=status.HTTP_201_CREATED)


class AdminPermissionLevelDetailView(APIView):
    """
    PATCH  /auth/admin/permission-levels/<pk>/
    DELETE /auth/admin/permission-levels/<pk>/
    """
    permission_classes = ADMIN_PERMS

    def _get_level(self, pk):
        try:
            return PermissionLevel.objects.select_related('department').get(pk=pk)
        except PermissionLevel.DoesNotExist:
            return None

    def patch(self, request, pk):
        level = self._get_level(pk)
        if not level:
            return Response({'detail': 'Clearance level not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminPermissionLevelSerializer(level, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # If changing ranking, check uniqueness
        new_ranking = serializer.validated_data.get('ranking')
        if new_ranking and new_ranking != level.ranking:
            if level.department.permission_levels.filter(ranking=new_ranking).exclude(pk=pk).exists():
                return Response(
                    {'detail': f'Ranking {new_ranking} is already taken in this department.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            updated = serializer.save()
            log_admin_action(
                request, 'UPDATE', 'PERMISSION_LEVEL', pk,
                {'name': updated.name, 'ranking': updated.ranking},
            )
        return Response(AdminPermissionLevelSerializer(updated).data)

    def delete(self, request, pk):
        level = self._get_level(pk)
        if not level:
            return Response({'detail': 'Clearance level not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Block deletion if active users are assigned to this level
        assigned = Profile.objects.filter(permission_level=level, is_deleted=False).count()
        if assigned:
            return Response(
                {
                    'detail': (
                        f'Cannot delete: {assigned} user(s) are assigned to this clearance level. '
                        'Re-assign them first.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        level_info = {'department': level.department.name, 'name': level.name, 'ranking': level.ranking}
        with transaction.atomic():
            level.delete()
            log_admin_action(request, 'DELETE', 'PERMISSION_LEVEL', pk, level_info)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------

class AdminUserListView(APIView):
    """GET /auth/admin/users/?search=&department_id=&page="""
    permission_classes = ADMIN_PERMS

    def get(self, request):
        search = request.query_params.get('search', '').strip()
        dept_id = request.query_params.get('department_id', '').strip()

        qs = (
            User.all_objects
            .select_related('profile__department', 'profile__permission_level')
            .order_by('email')
        )

        if search:
            qs = qs.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        if dept_id:
            qs = qs.filter(profile__department_id=dept_id)

        paginator = SmallPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AdminUserListSerializer(page, many=True).data)


class AdminUserAssignView(APIView):
    """POST /auth/admin/users/<pk>/assign/ — assign department + clearance level."""
    permission_classes = ADMIN_PERMS

    def post(self, request, pk):
        try:
            user = User.all_objects.select_related('profile').get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dept = serializer.validated_data['_department']
        level = serializer.validated_data['_permission_level']

        profile = user.profile
        old = {
            'department': profile.department.name if profile.department_id else None,
            'permission_level': profile.permission_level.name if profile.permission_level_id else None,
        }

        with transaction.atomic():
            profile.department = dept
            profile.permission_level = level
            profile.save(update_fields=['department', 'permission_level'])
            log_admin_action(
                request, 'ASSIGN', 'USER', pk,
                {
                    'user_email': user.email,
                    'old': old,
                    'new': {
                        'department': dept.name if dept else None,
                        'permission_level': level.name if level else None,
                    },
                },
            )

        return Response(AdminUserListSerializer(user).data)


class AdminUserToggleAdminView(APIView):
    """POST /auth/admin/users/<pk>/toggle-admin/ — promote/demote superuser."""
    permission_classes = ADMIN_PERMS

    def post(self, request, pk):
        try:
            user = User.all_objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response(
                {'detail': 'You cannot change your own admin status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_value = user.is_superuser
        new_value = not old_value

        with transaction.atomic():
            user.is_superuser = new_value
            user.is_staff = new_value
            user.save(update_fields=['is_superuser', 'is_staff'])
            log_admin_action(
                request, 'ROLE_TOGGLE', 'USER', pk,
                {'user_email': user.email, 'is_superuser': new_value},
            )

        return Response({'user_id': pk, 'email': user.email, 'is_superuser': new_value})


# ---------------------------------------------------------------------------
# Audit Logs (read-only)
# ---------------------------------------------------------------------------

class AdminAuditLogListView(APIView):
    """GET /auth/admin/audit-logs/?action_type=&target_type=&page="""
    permission_classes = ADMIN_PERMS

    def get(self, request):
        action_type = request.query_params.get('action_type', '').strip()
        target_type = request.query_params.get('target_type', '').strip()

        qs = AuditLog.objects.select_related('actor').order_by('-timestamp')
        if action_type:
            qs = qs.filter(action_type=action_type.upper())
        if target_type:
            qs = qs.filter(target_type=target_type.upper())

        paginator = SmallPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AuditLogSerializer(page, many=True).data)
