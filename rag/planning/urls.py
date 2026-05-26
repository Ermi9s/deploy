from django.urls import path

from .views import (
    InternalCheckDocumentView,
    InternalSweepView,
    MilestoneDetailView,
    MilestoneListCreateView,
    MilestoneRejectView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    PlanDetailView,
    PlanListCreateView,
)

urlpatterns = [
    # Plans
    path('plans/', PlanListCreateView.as_view(), name='plan-list-create'),
    path('plans/<uuid:pk>/', PlanDetailView.as_view(), name='plan-detail'),

    # Milestones (nested under plan)
    path('plans/<uuid:pk>/milestones/', MilestoneListCreateView.as_view(), name='milestone-list-create'),

    # Milestone operations
    path('milestones/<uuid:pk>/', MilestoneDetailView.as_view(), name='milestone-detail'),
    path('milestones/<uuid:pk>/reject/', MilestoneRejectView.as_view(), name='milestone-reject'),

    # Notifications
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notification-read-all'),
    path('notifications/<uuid:pk>/read/', NotificationMarkReadView.as_view(), name='notification-read'),

    # Internal (service-to-service, X-Service-Secret header)
    path('internal/check-document/', InternalCheckDocumentView.as_view(), name='internal-check-document'),
    path('internal/sweep/', InternalSweepView.as_view(), name='internal-sweep'),
]
