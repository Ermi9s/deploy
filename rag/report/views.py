"""
REST API views for the Report Generation module.

Endpoints:
  GET  /api/report/jobs/             — paginated list of the caller's report jobs
  POST /api/report/jobs/             — create a new job + fire background task
  GET  /api/report/jobs/<id>/        — full job detail (includes sub-reports + final)
  POST /api/report/jobs/<id>/store/  — store completed report to Drive + re-ingest

Views are intentionally thin: they validate input, call the service layer,
and map results to HTTP responses.  All business logic lives in services.py.
"""
from __future__ import annotations

import logging

from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ReportJob
from .serializers import (
    CreateReportJobSerializer,
    ReportJobDetailSerializer,
    ReportJobListSerializer,
)
from .services import (
    DriveSyncError,
    create_report_job,
    get_job_for_user,
    get_mac,
    get_user_id,
    list_jobs_for_user,
    store_report_to_drive,
)

logger = logging.getLogger(__name__)


class ReportJobPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class JobListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_id = get_user_id(request)
        qs = list_jobs_for_user(user_id)
        paginator = ReportJobPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            ReportJobListSerializer(page, many=True).data
        )

    def post(self, request):
        user_id = get_user_id(request)
        if not user_id:
            return Response(
                {"detail": "Could not resolve user from token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = CreateReportJobSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        department_id, permission_ranking = get_mac(request)

        job = create_report_job(
            user_id=user_id,
            title=serializer.validated_data["title"],
            agenda_texts=serializer.validated_data["agendas"],
            department_id=department_id,
            permission_ranking=permission_ranking,
        )

        return Response(
            ReportJobDetailSerializer(job).data,
            status=status.HTTP_201_CREATED,
        )


class JobDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        job = get_job_for_user(pk, get_user_id(request))
        if not job:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ReportJobDetailSerializer(job).data)

    def delete(self, request, pk):
        job = get_job_for_user(pk, get_user_id(request))
        if not job:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JobStoreToDriveView(APIView):
    """POST /api/report/jobs/<id>/store/"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        job = get_job_for_user(pk, get_user_id(request))
        if not job:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if job.status != ReportJob.STATUS_COMPLETED:
            return Response(
                {"detail": "Report is not yet completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if job.drive_item_id:
            return Response(
                {"detail": "Report already stored.", "drive_item_id": job.drive_item_id},
                status=status.HTTP_200_OK,
            )

        try:
            drive_item_id = store_report_to_drive(job, request)
        except DriveSyncError as exc:
            logger.error(
                "Drive sync failed job_id=%s step=%s detail=%s",
                pk, exc.step, exc.detail,
            )
            return Response({"detail": exc.detail}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"drive_item_id": drive_item_id}, status=status.HTTP_200_OK)
