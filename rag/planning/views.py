"""
REST API views for the Planning feature.

Public endpoints (JWT required):
  GET  POST  /api/planning/plans/
  GET  PATCH DELETE  /api/planning/plans/{id}/
  GET  POST  /api/planning/plans/{id}/milestones/
  PATCH DELETE  /api/planning/milestones/{id}/
  POST  /api/planning/milestones/{id}/reject/
  GET  /api/planning/notifications/
  POST /api/planning/notifications/{id}/read/
  POST /api/planning/notifications/read-all/

Internal endpoints (X-Service-Secret header required):
  POST /api/planning/internal/check-document/
  POST /api/planning/internal/sweep/
"""
from __future__ import annotations

import logging

from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Milestone, Plan, PlanningNotification
from .serializers import (
    DocumentCheckRequestSerializer,
    MilestoneCreateSerializer,
    MilestoneSerializer,
    MilestoneUpdateSerializer,
    PlanListSerializer,
    PlanningNotificationSerializer,
    PlanSerializer,
)
from .services import process_document_for_milestones, sweep_all_open_milestones

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_id_from_request(request) -> int:
    return int(getattr(request.auth, 'payload', {}).get('user_id', 0))


def _department_id_from_request(request) -> str | None:
    return getattr(request.auth, 'payload', {}).get('department_id')


class PlanPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ---------------------------------------------------------------------------
# Permission: service-to-service secret
# ---------------------------------------------------------------------------

class ServiceSecretPermission(permissions.BasePermission):
    """
    Grants access only when the X-Service-Secret header matches
    settings.PLANNING_SERVICE_SECRET.  Used for internal endpoints
    called by the workers service — no user JWT involved.
    """
    def has_permission(self, request, view) -> bool:
        from django.conf import settings
        secret = request.headers.get('X-Service-Secret', '')
        configured = getattr(settings, 'PLANNING_SERVICE_SECRET', '')
        return bool(configured) and secret == configured


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------

class PlanListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='List plans',
        description='Returns all active plans for the caller\'s department.',
        responses={200: PlanListSerializer(many=True)},
    )
    def get(self, request):
        dept_id = _department_id_from_request(request)
        if not dept_id:
            return Response(
                {'detail': 'department_id missing from token.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = Plan.objects.filter(department_id=dept_id, is_active=True)
        paginator = PlanPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = PlanListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        summary='Create plan',
        request=PlanSerializer,
        responses={201: PlanSerializer},
    )
    def post(self, request):
        dept_id = _department_id_from_request(request)
        user_id = _user_id_from_request(request)
        if not dept_id or not user_id:
            return Response(
                {'detail': 'department_id and user_id are required in the token.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = serializer.save(
            department_id=dept_id,
            created_by_user_id=user_id,
        )
        return Response(PlanSerializer(plan).data, status=status.HTTP_201_CREATED)


class PlanDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_plan(self, pk, dept_id):
        try:
            return Plan.objects.get(id=pk, department_id=dept_id, is_active=True)
        except Plan.DoesNotExist:
            return None

    @extend_schema(
        summary='Retrieve plan',
        responses={200: PlanSerializer, 404: OpenApiResponse(description='Not found')},
    )
    def get(self, request, pk):
        dept_id = _department_id_from_request(request)
        plan = self._get_plan(pk, dept_id)
        if not plan:
            return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PlanSerializer(plan, context={'request': request}).data)

    @extend_schema(
        summary='Update plan',
        request=PlanSerializer,
        responses={200: PlanSerializer, 403: OpenApiResponse(description='Not plan creator')},
    )
    def patch(self, request, pk):
        dept_id = _department_id_from_request(request)
        user_id = _user_id_from_request(request)
        plan = self._get_plan(pk, dept_id)
        if not plan:
            return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)
        if plan.created_by_user_id != user_id:
            return Response(
                {'detail': 'Only the plan creator can edit this plan.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PlanSerializer(plan, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PlanSerializer(plan, context={'request': request}).data)

    @extend_schema(
        summary='Deactivate plan',
        responses={
            204: OpenApiResponse(description='Plan deactivated'),
            403: OpenApiResponse(description='Not plan creator'),
        },
    )
    def delete(self, request, pk):
        dept_id = _department_id_from_request(request)
        user_id = _user_id_from_request(request)
        plan = self._get_plan(pk, dept_id)
        if not plan:
            return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)
        if plan.created_by_user_id != user_id:
            return Response(
                {'detail': 'Only the plan creator can delete this plan.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        plan.is_active = False
        plan.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Milestones (nested under a plan)
# ---------------------------------------------------------------------------

class MilestoneListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_plan(self, pk, dept_id):
        try:
            return Plan.objects.get(id=pk, department_id=dept_id, is_active=True)
        except Plan.DoesNotExist:
            return None

    @extend_schema(
        summary='List milestones',
        responses={200: MilestoneSerializer(many=True)},
    )
    def get(self, request, pk):
        dept_id = _department_id_from_request(request)
        plan = self._get_plan(pk, dept_id)
        if not plan:
            return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)
        milestones = plan.milestones.all()
        return Response(MilestoneSerializer(milestones, many=True, context={'request': request}).data)

    @extend_schema(
        summary='Create milestone',
        request=MilestoneCreateSerializer,
        responses={201: MilestoneSerializer},
    )
    def post(self, request, pk):
        dept_id = _department_id_from_request(request)
        plan = self._get_plan(pk, dept_id)
        if not plan:
            return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = MilestoneCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        milestone = serializer.save(plan=plan)
        return Response(MilestoneSerializer(milestone).data, status=status.HTTP_201_CREATED)


class MilestoneDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_milestone(self, pk, dept_id):
        try:
            return Milestone.objects.select_related('plan').get(
                id=pk, plan__department_id=dept_id, plan__is_active=True
            )
        except Milestone.DoesNotExist:
            return None

    @extend_schema(
        summary='Update or manually complete a milestone',
        request=MilestoneUpdateSerializer,
        responses={200: MilestoneSerializer},
    )
    def patch(self, request, pk):
        dept_id = _department_id_from_request(request)
        milestone = self._get_milestone(pk, dept_id)
        if not milestone:
            return Response({'detail': 'Milestone not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MilestoneUpdateSerializer(milestone, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        manually_complete = serializer.validated_data.pop('manually_complete', False)

        # Update editable fields (title, description, due_date)
        for field, value in serializer.validated_data.items():
            setattr(milestone, field, value)
        milestone.save(update_fields=[
            *serializer.validated_data.keys(), 'updated_at'
        ] if serializer.validated_data else ['updated_at'])

        if manually_complete:
            milestone.mark_manually_complete()

        return Response(MilestoneSerializer(milestone, context={'request': request}).data)

    @extend_schema(
        summary='Delete milestone',
        responses={204: OpenApiResponse(description='Deleted')},
    )
    def delete(self, request, pk):
        dept_id = _department_id_from_request(request)
        milestone = self._get_milestone(pk, dept_id)
        if not milestone:
            return Response({'detail': 'Milestone not found.'}, status=status.HTTP_404_NOT_FOUND)
        milestone.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MilestoneRejectView(APIView):
    """Reject an AI-completed milestone — reverts to OPEN."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Reject auto-completion',
        description=(
            'Reject an AI-completed milestone. The milestone reverts to OPEN '
            'and the triggering document is blocked from re-completing it. '
            'Only the plan creator can reject.'
        ),
        responses={
            200: MilestoneSerializer,
            400: OpenApiResponse(description='Milestone is not auto-completed'),
            403: OpenApiResponse(description='Only plan creator can reject'),
            404: OpenApiResponse(description='Milestone not found'),
        },
    )
    def post(self, request, pk):
        dept_id = _department_id_from_request(request)
        user_id = _user_id_from_request(request)
        try:
            milestone = Milestone.objects.select_related('plan').get(
                id=pk, plan__department_id=dept_id, plan__is_active=True
            )
        except Milestone.DoesNotExist:
            return Response({'detail': 'Milestone not found.'}, status=status.HTTP_404_NOT_FOUND)

        if milestone.plan.created_by_user_id != user_id:
            return Response(
                {'detail': 'Only the plan creator can reject milestone completions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if milestone.status != Milestone.Status.AUTO_COMPLETED:
            return Response(
                {'detail': 'Only auto-completed milestones can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        milestone.reject_completion()
        logger.info('Milestone %s rejected by user %s', milestone.id, user_id)
        return Response(MilestoneSerializer(milestone, context={'request': request}).data)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='List in-app notifications',
        description='Returns planning notifications for the authenticated user, newest first.',
        responses={200: PlanningNotificationSerializer(many=True)},
    )
    def get(self, request):
        user_id = _user_id_from_request(request)
        qs = PlanningNotification.objects.filter(user_id=user_id).select_related('milestone__plan')
        # Optionally filter by unread only
        unread_only = request.query_params.get('unread', '').lower() == 'true'
        if unread_only:
            qs = qs.filter(is_read=False)
        paginator = PlanPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            PlanningNotificationSerializer(page, many=True, context={'request': request}).data
        )


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Mark notification as read',
        responses={200: PlanningNotificationSerializer},
    )
    def post(self, request, pk):
        user_id = _user_id_from_request(request)
        try:
            notification = PlanningNotification.objects.get(id=pk, user_id=user_id)
        except PlanningNotification.DoesNotExist:
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(PlanningNotificationSerializer(notification, context={'request': request}).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Mark all notifications as read',
        responses={200: {'type': 'object', 'properties': {'marked': {'type': 'integer'}}}},
    )
    def post(self, request):
        user_id = _user_id_from_request(request)
        count = PlanningNotification.objects.filter(
            user_id=user_id, is_read=False
        ).update(is_read=True)
        return Response({'marked': count})


# ---------------------------------------------------------------------------
# Internal endpoints (called by workers service)
# ---------------------------------------------------------------------------

class InternalCheckDocumentView(APIView):
    """
    Called by the workers service after a document is successfully indexed.
    Authenticated via X-Service-Secret header (no user JWT).
    """
    permission_classes = [ServiceSecretPermission]
    authentication_classes = []  # Skip JWT auth for this endpoint

    @extend_schema(
        summary='[Internal] Trigger milestone check for a document',
        request=DocumentCheckRequestSerializer,
        responses={200: {'type': 'object'}},
    )
    def post(self, request):
        serializer = DocumentCheckRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_id: str = serializer.validated_data['document_id']
        filename: str = serializer.validated_data['filename']
        department_ids: list[str] = serializer.validated_data['department_ids']
        min_ranking: int = serializer.validated_data.get('min_ranking', 0)

        try:
            results = process_document_for_milestones(
                document_id=document_id,
                filename=filename,
                department_ids=department_ids,
                min_ranking=min_ranking,
            )
            completed = sum(1 for r in results if r['completed'])
            return Response({
                'checked': len(results),
                'auto_completed': completed,
                'results': results,
            })
        except Exception:
            logger.exception(
                'Milestone check failed for document_id=%s', document_id
            )
            return Response(
                {'detail': 'Internal error during milestone check.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class InternalSweepView(APIView):
    """
    Called by the Celery Beat task (via workers) on the configured schedule.
    Runs the full periodic milestone sweep against the ES corpus.
    """
    permission_classes = [ServiceSecretPermission]
    authentication_classes = []

    @extend_schema(
        summary='[Internal] Run periodic milestone sweep',
        responses={200: {'type': 'object'}},
    )
    def post(self, request):
        try:
            result = sweep_all_open_milestones()
            return Response(result)
        except Exception:
            logger.exception('Periodic milestone sweep failed.')
            return Response(
                {'detail': 'Internal error during sweep.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
