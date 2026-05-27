from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import InternalPlanningEventSerializer, NotificationSerializer


def _user_id_from_request(request) -> int:
    return int(getattr(request.auth, 'payload', {}).get('user_id', 0))


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ServiceSecretPermission(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        secret = request.headers.get('X-Service-Secret', '')
        configured = getattr(settings, 'PLANNING_SERVICE_SECRET', '')
        return bool(configured) and secret == configured


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_id = _user_id_from_request(request)
        qs = Notification.objects.filter(user_id=user_id)

        unread_only = request.query_params.get('unread', '').lower() == 'true'
        if unread_only:
            qs = qs.filter(is_read=False)

        paginator = NotificationPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            NotificationSerializer(page, many=True, context={'request': request}).data
        )


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user_id = _user_id_from_request(request)
        try:
            notification = Notification.objects.get(id=pk, user_id=user_id)
        except Notification.DoesNotExist:
            return Response({'detail': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification, context={'request': request}).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_id = _user_id_from_request(request)
        count = Notification.objects.filter(user_id=user_id, is_read=False).update(is_read=True)
        return Response({'marked': count})


class InternalPlanningEventView(APIView):
    permission_classes = [ServiceSecretPermission]
    authentication_classes = []

    def post(self, request):
        serializer = InternalPlanningEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        milestone = payload.get('milestone') or {}
        notification = Notification.objects.create(
            user_id=payload['user_id'],
            message=payload['message'],
            notification_type=payload.get('notification_type', 'generic'),
            milestone_id=milestone.get('id') or None,
            milestone_title=milestone.get('title', ''),
            milestone_status=milestone.get('status', ''),
            plan_id=milestone.get('plan_id') or None,
            plan_title=milestone.get('plan_title', ''),
            reference_document_id=milestone.get('reference_document_id', ''),
            reference_filename=milestone.get('reference_filename', ''),
            reference_mac_ranking=milestone.get('reference_mac_ranking'),
        )

        channel_layer = get_channel_layer()
        if channel_layer:
            data = NotificationSerializer(notification).data
            async_to_sync(channel_layer.group_send)(
                f'notif_user_{notification.user_id}',
                {
                    'type': 'notification.message',
                    'data': data,
                },
            )

        return Response({'id': str(notification.id)}, status=status.HTTP_201_CREATED)
