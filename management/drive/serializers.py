from __future__ import annotations

from rest_framework import serializers

from .models import DriveItem, FileVersion


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


class RegisterUploadSerializer(serializers.Serializer):
    documentId = serializers.UUIDField()
    taskId = serializers.CharField()
    name = serializers.CharField(max_length=255)
    mimeType = serializers.CharField(max_length=255)
    fileSize = serializers.IntegerField(min_value=0)
    parentId = serializers.UUIDField(required=False, allow_null=True)
    storagePath = serializers.CharField(required=False, allow_blank=True)
    # MAC: {"<dept-uuid>": <min_ranking_int>, ...}
    departmentAccess = serializers.JSONField(required=False, default=dict)


class RequestUploadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    mimeType = serializers.CharField(max_length=255)
    parentId = serializers.UUIDField(required=False, allow_null=True)
    size = serializers.IntegerField(min_value=1)


class ConfirmUploadSerializer(serializers.Serializer):
    storageKey = serializers.CharField(max_length=1024)
    checksum = serializers.CharField(max_length=128, allow_blank=True, required=False)
    documentId = serializers.UUIDField(required=False, allow_null=True)
    taskId = serializers.CharField(required=False, allow_blank=True)
    # MAC: {"<dept-uuid>": <min_ranking_int>, ...}
    departmentAccess = serializers.JSONField(required=False, default=dict)


class FileVersionSerializer(serializers.ModelSerializer):
    storageKey = serializers.CharField(source='storage_key', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = FileVersion
        fields = ('id', 'version', 'size', 'checksum', 'storageKey', 'createdAt')
        read_only_fields = fields


