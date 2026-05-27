from rest_framework import serializers

from .models import ReportAgenda, ReportJob


class ReportAgendaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportAgenda
        fields = ["id", "order", "text", "sub_report", "sources", "status"]
        read_only_fields = ["id", "sub_report", "sources", "status"]


class ReportJobListSerializer(serializers.ModelSerializer):
    """Lightweight serialiser for the list view — omits final_report."""

    agendas_count = serializers.SerializerMethodField()

    class Meta:
        model = ReportJob
        fields = [
            "id", "title", "status", "agendas_count",
            "drive_item_id", "created_at", "updated_at",
        ]

    def get_agendas_count(self, obj: ReportJob) -> int:
        return obj.agendas.count()


class ReportJobDetailSerializer(serializers.ModelSerializer):
    """Full serialiser including nested agendas and final_report."""

    agendas = ReportAgendaSerializer(many=True, read_only=True)

    class Meta:
        model = ReportJob
        fields = [
            "id", "title", "status", "final_report", "error_message",
            "agendas", "drive_item_id", "created_at", "updated_at",
        ]


class CreateReportJobSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    agendas = serializers.ListField(
        child=serializers.CharField(min_length=1),
        min_length=1,
        max_length=10,
        error_messages={
            "min_length": "At least 1 agenda item is required.",
            "max_length": "A maximum of 10 agenda items is allowed.",
        },
    )
