from __future__ import annotations

from rest_framework import serializers

from .models import DriveItem, FileVersion


# ---------------------------------------------------------------------------
# MAC helpers
# ---------------------------------------------------------------------------

class DepartmentAccessValidatorMixin:
    """
    Mixin for upload serializers that validates the `departmentAccess` field.

    Rules enforced:
      - Must be a dict (not a list, string, or other type).
      - Every key must be a non-empty string (UUID string of a Department).
      - Every value must be a non-negative integer (minimum ranking).
      - The dict must NOT be empty — callers must always specify at least one
        department (the Public department is pre-populated by the frontend).
    """

    def validate_departmentAccess(self, value):  # noqa: N802 — DRF naming convention
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                'departmentAccess must be a JSON object mapping department UUIDs to integer rankings.'
            )
        for key, ranking in value.items():
            if not isinstance(key, str) or not key.strip():
                raise serializers.ValidationError(
                    f'departmentAccess key {key!r} must be a non-empty string (department UUID).'
                )
            if not isinstance(ranking, int) or isinstance(ranking, bool) or ranking < 0:
                raise serializers.ValidationError(
                    f'departmentAccess value for {key!r} must be a non-negative integer, got {ranking!r}.'
                )
        return value


class DriveItemSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source='item_type', read_only=True)
    parentId = serializers.UUIDField(source='parent_id', allow_null=True, required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    deletedAt = serializers.DateTimeField(source='deleted_at', allow_null=True, read_only=True)
    fileType = serializers.CharField(source='mime_type', allow_blank=True, required=False)
    fileSize = serializers.IntegerField(source='file_size', read_only=True)
    sourceDocumentId = serializers.UUIDField(source='source_document_id', allow_null=True, read_only=True)
    taskId = serializers.CharField(source='task_id', read_only=True)
    departmentAccess = serializers.JSONField(source='department_access', read_only=True)

    class Meta:
        model = DriveItem
        fields = (
            'id',
            'name',
            'type',
            'parentId',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'fileType',
            'fileSize',
            'sourceDocumentId',
            'taskId',
            'departmentAccess',
        )


class CreateFolderSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    parentId = serializers.UUIDField(required=False, allow_null=True)


class RenameItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)


class MoveItemSerializer(serializers.Serializer):
    parentId = serializers.UUIDField(required=False, allow_null=True)


class RegisterUploadSerializer(DepartmentAccessValidatorMixin, serializers.Serializer):
    documentId = serializers.UUIDField()
    taskId = serializers.CharField()
    name = serializers.CharField(max_length=255)
    mimeType = serializers.CharField(max_length=255)
    fileSize = serializers.IntegerField(min_value=0)
    parentId = serializers.UUIDField(required=False, allow_null=True)
    storagePath = serializers.CharField(required=False, allow_blank=True)
    # MAC: {"<dept-uuid>": <min_ranking_int>, ...} — required, validated by mixin
    departmentAccess = serializers.JSONField()


class RequestUploadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    mimeType = serializers.CharField(max_length=255)
    parentId = serializers.UUIDField(required=False, allow_null=True)
    size = serializers.IntegerField(min_value=1)


class ConfirmUploadSerializer(DepartmentAccessValidatorMixin, serializers.Serializer):
    storageKey = serializers.CharField(max_length=1024)
    checksum = serializers.CharField(max_length=128, allow_blank=True, required=False)
    documentId = serializers.UUIDField(required=False, allow_null=True)
    taskId = serializers.CharField(required=False, allow_blank=True)
    # MAC: {"<dept-uuid>": <min_ranking_int>, ...} — required, validated by mixin
    departmentAccess = serializers.JSONField()


class FileVersionSerializer(serializers.ModelSerializer):
    storageKey = serializers.CharField(source='storage_key', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = FileVersion
        fields = ('id', 'version', 'size', 'checksum', 'storageKey', 'createdAt')
        read_only_fields = fields


