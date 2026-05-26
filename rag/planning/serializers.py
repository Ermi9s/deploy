"""
Serializers for the Planning feature.
"""
from __future__ import annotations

from rest_framework import serializers

from .models import Milestone, Plan, PlanningNotification


class MilestoneSerializer(serializers.ModelSerializer):
    is_completed = serializers.BooleanField(read_only=True)

    class Meta:
        model = Milestone
        fields = [
            'id', 'plan', 'title', 'description', 'due_date',
            'status', 'is_completed',
            'completed_at', 'completion_summary', 'completion_confidence',
            'reference_document_id', 'reference_filename',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'plan', 'status', 'is_completed',
            'completed_at', 'completion_summary', 'completion_confidence',
            'reference_document_id', 'reference_filename',
            'created_at', 'updated_at',
        ]
        # rejected_document_ids is intentionally excluded from the API response.


class MilestoneCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = ['title', 'description', 'due_date']


class MilestoneUpdateSerializer(serializers.ModelSerializer):
    """Used for PATCH — allows editing metadata or manually completing."""
    manually_complete = serializers.BooleanField(
        write_only=True, required=False, default=False,
        help_text='Set to true to manually mark this milestone as complete.',
    )

    class Meta:
        model = Milestone
        fields = ['title', 'description', 'due_date', 'manually_complete']


class PlanSerializer(serializers.ModelSerializer):
    milestone_count = serializers.SerializerMethodField()
    open_count = serializers.SerializerMethodField()
    completed_count = serializers.SerializerMethodField()
    milestones = MilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = Plan
        fields = [
            'id', 'title', 'description', 'department_id',
            'created_by_user_id', 'is_active',
            'milestone_count', 'open_count', 'completed_count',
            'milestones',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'department_id', 'created_by_user_id',
            'milestone_count', 'open_count', 'completed_count',
            'milestones', 'created_at', 'updated_at',
        ]

    def get_milestone_count(self, obj: Plan) -> int:
        return obj.milestones.count()

    def get_open_count(self, obj: Plan) -> int:
        return obj.milestones.filter(status=Milestone.Status.OPEN).count()

    def get_completed_count(self, obj: Plan) -> int:
        return obj.milestones.exclude(status=Milestone.Status.OPEN).count()


class PlanListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views (no nested milestones)."""
    milestone_count = serializers.SerializerMethodField()
    open_count = serializers.SerializerMethodField()
    completed_count = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = [
            'id', 'title', 'description', 'department_id',
            'created_by_user_id', 'is_active',
            'milestone_count', 'open_count', 'completed_count',
            'created_at', 'updated_at',
        ]

    def get_milestone_count(self, obj: Plan) -> int:
        return obj.milestones.count()

    def get_open_count(self, obj: Plan) -> int:
        return obj.milestones.filter(status=Milestone.Status.OPEN).count()

    def get_completed_count(self, obj: Plan) -> int:
        return obj.milestones.exclude(status=Milestone.Status.OPEN).count()


class PlanningNotificationSerializer(serializers.ModelSerializer):
    milestone_title = serializers.CharField(source='milestone.title', read_only=True)
    plan_id = serializers.UUIDField(source='milestone.plan_id', read_only=True)

    class Meta:
        model = PlanningNotification
        fields = [
            'id', 'user_id', 'milestone', 'milestone_title', 'plan_id',
            'message', 'is_read', 'created_at',
        ]
        read_only_fields = [
            'id', 'user_id', 'milestone', 'milestone_title',
            'plan_id', 'message', 'created_at',
        ]


class DocumentCheckRequestSerializer(serializers.Serializer):
    """Payload sent by the workers service to trigger a milestone check."""
    document_id = serializers.CharField()
    filename = serializers.CharField()
    department_ids = serializers.ListField(
        child=serializers.CharField(), allow_empty=False
    )
