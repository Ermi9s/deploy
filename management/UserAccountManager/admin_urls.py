"""URL patterns for admin-only endpoints (/auth/admin/…)."""
from django.urls import path
from .admin_views import (
    AdminDashboardView,
    AdminDepartmentListCreateView,
    AdminDepartmentDetailView,
    AdminPermissionLevelListCreateView,
    AdminPermissionLevelDetailView,
    AdminUserListView,
    AdminUserAssignView,
    AdminUserToggleAdminView,
    AdminAuditLogListView,
)

urlpatterns = [
    # Dashboard stats
    path('dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),

    # Departments
    path('departments/', AdminDepartmentListCreateView.as_view(), name='admin-department-list'),
    path('departments/<int:pk>/', AdminDepartmentDetailView.as_view(), name='admin-department-detail'),

    # Clearance levels (nested under department for create/list, flat for edit/delete)
    path('departments/<int:dept_pk>/permission-levels/', AdminPermissionLevelListCreateView.as_view(), name='admin-level-list'),
    path('permission-levels/<int:pk>/', AdminPermissionLevelDetailView.as_view(), name='admin-level-detail'),

    # Users
    path('users/', AdminUserListView.as_view(), name='admin-user-list'),
    path('users/<int:pk>/assign/', AdminUserAssignView.as_view(), name='admin-user-assign'),
    path('users/<int:pk>/toggle-admin/', AdminUserToggleAdminView.as_view(), name='admin-user-toggle-admin'),

    # Audit logs
    path('audit-logs/', AdminAuditLogListView.as_view(), name='admin-audit-logs'),
]
