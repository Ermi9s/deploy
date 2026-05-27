from django.urls import path

from .views import JobDetailView, JobListCreateView, JobStoreToDriveView

urlpatterns = [
    path("jobs/", JobListCreateView.as_view(), name="report-job-list-create"),
    path("jobs/<uuid:pk>/", JobDetailView.as_view(), name="report-job-detail"),
    path("jobs/<uuid:pk>/store/", JobStoreToDriveView.as_view(), name="report-job-store"),
]
