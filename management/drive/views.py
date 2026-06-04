from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from django.utils.encoding import force_str
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DriveItem, FileVersion
from .services import minio_service
from .serializers import (
    CreateFolderSerializer,
    DriveItemSerializer,
    MoveItemSerializer,
    RegisterUploadSerializer,
    RenameItemSerializer,
    RequestUploadSerializer,
    ConfirmUploadSerializer,
    FileVersionSerializer,
)


class DriveItemBaseAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return DriveItem.objects.all()

        from django.db.models import Q
        from UserAccountManager.models import Department

        # ── Layer 1: Always include files the user owns ───────────────────────
        owns_query = Q(owner=user)

        # ── Layer 2: Public-tagged files (visible to everyone) ────────────────
        # Any file whose department_access map includes the Public dept UUID
        # at minimum ranking 1 is accessible to all authenticated users.
        public_query = Q()
        try:
            pub_dept = Department.objects.get(name='Public')
            pub_uuid_str = str(pub_dept.uuid)
            public_query = Q(
                department_access__has_key=pub_uuid_str,
                **{f"department_access__{pub_uuid_str}__lte": 1}
            )
        except Department.DoesNotExist:
            pass

        # ── Layer 3: Department-specific MAC access ────────────────────────────
        # If the user has a real (non-Public) department + permission_level,
        # also include files their clearance allows within that department.
        dept_mac_query = Q()
        try:
            profile = getattr(user, 'profile', None)
            if profile:
                dept = profile.department
                perm = profile.permission_level
                # Only apply when the user has a *real* department (not just Public)
                # and a valid permission level.
                if dept and perm is not None and dept.name != 'Public':
                    dept_uuid_str = str(dept.uuid)
                    ranking_val = int(perm.ranking)
                    dept_mac_query = Q(
                        department_access__has_key=dept_uuid_str,
                        **{f"department_access__{dept_uuid_str}__lte": ranking_val}
                    )
        except Exception:
            pass

        return DriveItem.objects.filter(owns_query | public_query | dept_mac_query)

    def _get_item(self, item_id, file_only=True, is_trashed=False):
        import uuid
        try:
            uuid.UUID(str(item_id))
        except ValueError:
            from django.http import Http404
            raise Http404("Invalid ID format")

        from django.db.models import Q
        filters = Q(id=item_id) | Q(source_document_id=item_id)

        queryset = self.get_queryset()
        if file_only:
            queryset = queryset.filter(item_type=DriveItem.ItemType.FILE)
        if is_trashed is not None:
            queryset = queryset.filter(is_trashed=is_trashed)

        return get_object_or_404(queryset, filters)

    def _resolve_parent(self, parent_id):
        if parent_id in (None, '', 'null'):
            return None
        return get_object_or_404(self.get_queryset(), id=parent_id, item_type=DriveItem.ItemType.FOLDER, is_trashed=False)

    def _trash_item(self, item: DriveItem):
        item.is_trashed = True
        item.deleted_at = timezone.now()
        item.save(update_fields=['is_trashed', 'deleted_at', 'updated_at'])
        if item.item_type == DriveItem.ItemType.FOLDER:
            for child in item.children.all():
                self._trash_item(child)

    def _restore_item(self, item: DriveItem):
        item.is_trashed = False
        item.deleted_at = None
        item.save(update_fields=['is_trashed', 'deleted_at', 'updated_at'])
        if item.item_type == DriveItem.ItemType.FOLDER:
            for child in item.children.all():
                self._restore_item(child)


class DriveItemListAPIView(DriveItemBaseAPIView):
    def get(self, request):
        parent_id = request.query_params.get('parentId')
        search_query = request.query_params.get('search', '').strip()

        queryset = self.get_queryset().filter(is_trashed=False)

        if search_query:
            queryset = queryset.filter(name__icontains=search_query)
        else:
            if parent_id in (None, '', 'null'):
                queryset = queryset.filter(parent__isnull=True)
            else:
                queryset = queryset.filter(parent_id=parent_id)

        serializer = DriveItemSerializer(queryset, many=True)
        return Response({'items': serializer.data})


class CreateFolderAPIView(DriveItemBaseAPIView):
    def post(self, request):
        serializer = CreateFolderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        parent = self._resolve_parent(serializer.validated_data.get('parentId'))
        item = DriveItem.objects.create(
            owner=request.user,
            name=serializer.validated_data['name'].strip(),
            item_type=DriveItem.ItemType.FOLDER,
            parent=parent,
        )
        return Response(DriveItemSerializer(item).data, status=status.HTTP_201_CREATED)


class RegisterUploadedDocumentAPIView(DriveItemBaseAPIView):
    def post(self, request):
        serializer = RegisterUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        parent = self._resolve_parent(data.get('parentId'))

        item, created = DriveItem.objects.update_or_create(
            owner=request.user,
            source_document_id=data['documentId'],
            defaults={
                'name': data['name'],
                'item_type': DriveItem.ItemType.FILE,
                'parent': parent,
                'mime_type': data['mimeType'],
                'file_size': data['fileSize'],
                'storage_path': data.get('storagePath', ''),
                'task_id': data['taskId'],
                'is_trashed': False,
                'deleted_at': None,
            },
        )
        return Response(DriveItemSerializer(item).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class RenameItemAPIView(DriveItemBaseAPIView):
    def patch(self, request, item_id):
        item = get_object_or_404(self.get_queryset(), id=item_id)
        serializer = RenameItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item.name = serializer.validated_data['name'].strip()
        item.save(update_fields=['name', 'updated_at'])
        return Response(DriveItemSerializer(item).data)


class MoveItemAPIView(DriveItemBaseAPIView):
    def patch(self, request, item_id):
        item = get_object_or_404(self.get_queryset(), id=item_id)
        serializer = MoveItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item.parent = self._resolve_parent(serializer.validated_data.get('parentId'))
        item.save(update_fields=['parent', 'updated_at'])
        return Response(DriveItemSerializer(item).data)


class DeleteItemAPIView(DriveItemBaseAPIView):
    def delete(self, request, item_id):
        item = get_object_or_404(self.get_queryset(), id=item_id)
        permanent = str(request.query_params.get('permanent', '')).lower() in {'1', 'true', 'yes'}
        if permanent:
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        self._trash_item(item)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RestoreItemAPIView(DriveItemBaseAPIView):
    def post(self, request, item_id):
        item = get_object_or_404(self.get_queryset(), id=item_id)
        self._restore_item(item)
        return Response(DriveItemSerializer(item).data)


class TrashListAPIView(DriveItemBaseAPIView):
    def get(self, request):
        queryset = self.get_queryset().filter(is_trashed=True)
        serializer = DriveItemSerializer(queryset, many=True)
        return Response({'items': serializer.data})


class RequestUploadURLAPIView(DriveItemBaseAPIView):
    def post(self, request):
        serializer = RequestUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if data['size'] > max_size_bytes:
            return Response({'error': f'File size exceeds {settings.MAX_UPLOAD_SIZE_MB}MB.'}, status=status.HTTP_400_BAD_REQUEST)

        self._resolve_parent(data.get('parentId'))

        storage_key = minio_service.generate_upload_key(request.user.id, data['name'])
        upload_url = minio_service.presigned_put_url(storage_key)

        return Response({
            'uploadUrl': upload_url,
            'storageKey': storage_key,
            'expiresIn': 600,
        })


class ConfirmUploadAPIView(DriveItemBaseAPIView):
    def post(self, request):
        serializer = ConfirmUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        val_data = serializer.validated_data

        name = request.data.get('name', 'unnamed')
        mime_type = request.data.get('mimeType', '')
        parent_id = request.data.get('parentId')
        drive_item_id = request.data.get('driveItemId')

        storage_key = val_data['storageKey']
        checksum = val_data.get('checksum', '')
        source_document_id = val_data.get('documentId')
        task_id = val_data.get('taskId', '')
        department_access = val_data.get('departmentAccess', {})

        if not minio_service.object_exists(storage_key):
            return Response({'error': 'Object not found in storage.'}, status=status.HTTP_400_BAD_REQUEST)

        size = minio_service.get_object_size(storage_key)
        parent = self._resolve_parent(parent_id)

        with transaction.atomic():
            if drive_item_id:
                item = get_object_or_404(self.get_queryset(), id=drive_item_id, item_type=DriveItem.ItemType.FILE)
                next_version = item.versions.order_by('-version').first().version + 1 if item.versions.exists() else 1
                item.file_size = size
                item.department_access = department_access
                if source_document_id:
                    item.source_document_id = source_document_id
                if task_id:
                    item.task_id = task_id
                item.save(update_fields=['file_size', 'department_access', 'source_document_id', 'task_id', 'updated_at'])
            else:
                item = DriveItem.objects.create(
                    owner=request.user,
                    name=name,
                    item_type=DriveItem.ItemType.FILE,
                    parent=parent,
                    mime_type=mime_type,
                    file_size=size,
                    storage_path=storage_key,
                    source_document_id=source_document_id,
                    task_id=task_id,
                    department_access=department_access,
                )
                next_version = 1

            FileVersion.objects.create(
                drive_item=item,
                storage_key=storage_key,
                version=next_version,
                size=size,
                checksum=checksum,
            )

        return Response(DriveItemSerializer(item).data, status=status.HTTP_201_CREATED)


class DownloadFileAPIView(DriveItemBaseAPIView):
    def get(self, request, item_id):
        item = self._get_item(item_id, file_only=True, is_trashed=False)
        version_param = request.query_params.get('version')

        if version_param:
            try:
                version_number = int(version_param)
            except ValueError:
                return Response({'error': 'Invalid version parameter.'}, status=status.HTTP_400_BAD_REQUEST)

            version_obj = item.versions.filter(version=version_number).first()
            if not version_obj:
                return Response({'error': 'Version not found.'}, status=status.HTTP_404_NOT_FOUND)

            url = minio_service.presigned_get_url(version_obj.storage_key)
            return Response({'downloadUrl': url})

        latest_version = item.versions.order_by('-version').first()
        if latest_version:
            url = minio_service.presigned_get_url(latest_version.storage_key)
            return Response({'downloadUrl': url})

        if item.storage_path:
            url = minio_service.presigned_get_url(item.storage_path)
            return Response({'downloadUrl': url})

        return Response({'error': 'No file versions found.'}, status=status.HTTP_404_NOT_FOUND)


class FileContentAPIView(DriveItemBaseAPIView):
    def get(self, request, item_id):
        item = self._get_item(item_id, file_only=True, is_trashed=False)

        version_param = request.query_params.get('version')
        if version_param:
            try:
                version_number = int(version_param)
            except ValueError:
                return Response({'error': 'Invalid version parameter.'}, status=status.HTTP_400_BAD_REQUEST)
            version_obj = item.versions.filter(version=version_number).first()
        else:
            version_obj = item.versions.order_by('-version').first()

        if not version_obj and not item.storage_path:
            return Response({'error': 'No file content found.'}, status=status.HTTP_404_NOT_FOUND)

        storage_key = version_obj.storage_key if version_obj else item.storage_path

        try:
            content_bytes = minio_service.get_object_bytes(storage_key)
            content = force_str(content_bytes, encoding='utf-8')
        except UnicodeDecodeError:
            return Response({'error': 'This file is not a UTF-8 text file and cannot be edited inline.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Failed to read file content.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'content': content,
            'version': version_obj.version if version_obj else None,
            'mimeType': item.mime_type,
            'name': item.name,
        })


class FileVersionListAPIView(DriveItemBaseAPIView):
    def get(self, request, item_id):
        item = self._get_item(item_id, file_only=True, is_trashed=None)
        versions = item.versions.order_by('-version')
        serializer = FileVersionSerializer(versions, many=True)
        return Response({'versions': serializer.data})
