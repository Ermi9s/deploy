from __future__ import annotations

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    milestone = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'message',
            'is_read',
            'created_at',
            'notification_type',
            'milestone',
        ]

    def get_milestone(self, obj: Notification) -> dict:
        return {
            'id': str(obj.milestone_id) if obj.milestone_id else None,
            'title': obj.milestone_title,
            'plan_title': obj.plan_title,
            'plan_id': str(obj.plan_id) if obj.plan_id else None,
            'status': obj.milestone_status or None,
            'reference_document_id': obj.reference_document_id or None,
            'reference_filename': obj.reference_filename or None,
            'reference_mac_ranking': obj.reference_mac_ranking,
        }


class InternalPlanningEventSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)
    message = serializers.CharField()
    notification_type = serializers.CharField(required=False, default='generic')
    milestone = serializers.DictField(required=False)
