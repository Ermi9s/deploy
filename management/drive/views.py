from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DriveItem
from .serializers import (
    CreateFolderSerializer,
    DriveItemSerializer,
    MoveItemSerializer,
    RegisterUploadSerializer,
    RenameItemSerializer,
)


class DriveItemBaseAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DriveItem.objects.filter(owner=self.request.user)

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
        queryset = self.get_queryset().filter(is_trashed=False)
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
