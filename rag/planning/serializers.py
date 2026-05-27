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
            'reference_document_id', 'reference_filename', 'reference_mac_ranking',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'plan', 'status', 'is_completed',
            'completed_at', 'completion_summary', 'completion_confidence',
            'reference_document_id', 'reference_filename', 'reference_mac_ranking',
            'created_at', 'updated_at',
        ]
        # rejected_document_ids is intentionally excluded from the API response.

    def to_representation(self, instance):
        """
        Redact reference_document_id and reference_filename when the requesting
        user's permission_ranking is below the file's reference_mac_ranking.

        Callers must pass context={'request': request} when instantiating this
        serializer (or its parent PlanSerializer) for redaction to take effect.
        Absent context is treated permissively (no redaction).
        """
        data = super().to_representation(instance)

        mac_ranking: int | None = instance.reference_mac_ranking
        if mac_ranking is None:
            # No restriction recorded — field is visible to all (e.g. public docs,
            # or milestones completed before this feature was deployed).
            return data

        request = self.context.get('request')
        if request is None:
            # No request context supplied — fail open (do not redact).
            return data

        caller_ranking: int | None = getattr(request.auth, 'payload', {}).get('permission_ranking')
        if caller_ranking is None:
            # No ranking claim in JWT — treat as lowest rank (redact).
            caller_ranking = 0

        if int(caller_ranking) < int(mac_ranking):
            data['reference_document_id'] = None
            data['reference_filename'] = None

        return data


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
    milestones = serializers.SerializerMethodField()

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

    def get_milestones(self, obj: Plan):
        """Serialize milestones, propagating request context for MAC redaction."""
        return MilestoneSerializer(
            obj.milestones.all(),
            many=True,
            context=self.context,  # forwards 'request' for MAC check
        ).data


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
    plan_title = serializers.CharField(source='milestone.plan.title', read_only=True)
    milestone_status = serializers.CharField(source='milestone.status', read_only=True)
    reference_document_id = serializers.CharField(source='milestone.reference_document_id', read_only=True)
    reference_filename = serializers.CharField(source='milestone.reference_filename', read_only=True)
    reference_mac_ranking = serializers.IntegerField(source='milestone.reference_mac_ranking', read_only=True, allow_null=True)

    class Meta:
        model = PlanningNotification
        fields = [
            'id', 'user_id', 'milestone', 'milestone_title', 'plan_id', 'plan_title',
            'milestone_status', 'reference_document_id', 'reference_filename',
            'reference_mac_ranking', 'message', 'is_read', 'created_at',
        ]
        read_only_fields = [
            'id', 'user_id', 'milestone', 'milestone_title', 'plan_id', 'plan_title',
            'milestone_status', 'reference_document_id', 'reference_filename',
            'reference_mac_ranking', 'message', 'created_at',
        ]

    def to_representation(self, instance):
        """Redact reference fields in notifications using the same MAC check."""
        data = super().to_representation(instance)
        mac_ranking = data.get('reference_mac_ranking')
        if mac_ranking is None:
            return data
        request = self.context.get('request')
        if request is None:
            return data
        caller_ranking = getattr(request.auth, 'payload', {}).get('permission_ranking', 0)
        if int(caller_ranking) < int(mac_ranking):
            data['reference_document_id'] = None
            data['reference_filename'] = None
        return data


class DocumentCheckRequestSerializer(serializers.Serializer):
    """Payload sent by the workers service to trigger a milestone check."""
    document_id = serializers.CharField()
    filename = serializers.CharField()
    department_ids = serializers.ListField(
        child=serializers.CharField(), allow_empty=False
    )
    # MAC: minimum ranking of the triggering document.
    # 0 / absent means the document is unrestricted (visible to all dept members).
    min_ranking = serializers.IntegerField(required=False, default=0)
