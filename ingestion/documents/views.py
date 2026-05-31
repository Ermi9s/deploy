from __future__ import annotations

import mimetypes
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import parsers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UploadedDocument
from .serializers import UploadAcceptedSerializer, UploadedDocumentStatusSerializer
from .services import enqueue_document, save_upload, sync_document_status

SUPPORTED_IMAGE_MIME_TYPES = {
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'image/bmp',
    'image/webp',
}
SUPPORTED_TEXT_MIME_TYPES = {
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/csv',
    'text/html',
    'application/json',
}
SUPPORTED_OFFICE_MIME_TYPES = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
}
SUPPORTED_MIME_TYPES = {
    'application/pdf',
    *SUPPORTED_IMAGE_MIME_TYPES,
    *SUPPORTED_TEXT_MIME_TYPES,
    *SUPPORTED_OFFICE_MIME_TYPES,
}


class UploadDocumentAPIView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    @extend_schema(
        summary="Upload Document",
        description="Upload a document for background ingestion. Supports PDF and various image formats.",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'file': {
                        'type': 'string',
                        'format': 'binary'
                    }
                },
                'required': ['file']
            }
        },
        responses={
            status.HTTP_202_ACCEPTED: UploadAcceptedSerializer,
            status.HTTP_400_BAD_REQUEST: OpenApiResponse(description='Validation error or unsupported file type'),
        }
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if upload is None:
            return Response(
                {'error': 'No file provided in multipart form-data under key "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if upload.size > settings.MAX_UPLOAD_SIZE:
            return Response(
                {'error': f'File exceeds MAX_UPLOAD_SIZE ({settings.MAX_UPLOAD_SIZE} bytes).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        extension = Path(upload.name).suffix.lower()
        mime_type = upload.content_type or mimetypes.guess_type(upload.name)[0] or 'application/octet-stream'
        
        EXT_TO_MIME = {
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.tiff': 'image/tiff',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.markdown': 'text/markdown',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.html': 'text/html',
            '.htm': 'text/html',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
        }
        
        if mime_type == 'application/octet-stream' or mime_type not in SUPPORTED_MIME_TYPES:
            if extension in EXT_TO_MIME:
                mime_type = EXT_TO_MIME[extension]
            else:
                return Response({'error': f'Unsupported file type: {mime_type} (extension: {extension})'}, status=status.HTTP_400_BAD_REQUEST)

        # MAC: parse and strictly validate the department permission matrix.
        # Expected format: JSON object {"<dept-uuid>": <min_ranking_int>, ...}
        # We reject empty maps so Elasticsearch chunks are never indexed without access control.
        import json
        raw_access = request.data.get('departmentAccess', None)
        if raw_access is None:
            return Response(
                {'error': 'departmentAccess is required. Include at least the Public department.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if isinstance(raw_access, str):
            try:
                department_access = json.loads(raw_access)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'departmentAccess must be valid JSON.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif isinstance(raw_access, dict):
            department_access = raw_access
        else:
            return Response(
                {'error': 'departmentAccess must be a JSON object.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(department_access, dict):
            return Response(
                {'error': 'departmentAccess must be a JSON object mapping department UUIDs to integer rankings.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not department_access:
            return Response(
                {'error': 'departmentAccess must not be empty. Include at least the Public department.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for key, ranking in department_access.items():
            if not isinstance(key, str) or not key.strip():
                return Response(
                    {'error': f'departmentAccess key {key!r} must be a non-empty string (department UUID).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not isinstance(ranking, int) or isinstance(ranking, bool) or ranking < 0:
                return Response(
                    {'error': f'departmentAccess value for {key!r} must be a non-negative integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        document = UploadedDocument.objects.create(
            original_filename=upload.name,
            mime_type=mime_type,
            storage_path='',
            status=UploadedDocument.Status.QUEUED,
            progress=0,
            stage='queued',
            department_access=department_access,
        )

        extension = Path(upload.name).suffix.lower()
        if not extension:
            MIME_TO_EXT = {
                'application/pdf': '.pdf',
                'image/png': '.png',
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/tiff': '.tiff',
                'image/bmp': '.bmp',
                'image/webp': '.webp',
                'text/plain': '.txt',
                'text/markdown': '.md',
                'application/json': '.json',
                'text/csv': '.csv',
                'text/html': '.html',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                'application/msword': '.doc',
            }
            extension = MIME_TO_EXT.get(mime_type, '.bin')

        stored_name = f'{document.id}{extension}'
        destination = save_upload(upload, settings.UPLOAD_ROOT, stored_name)

        document.storage_path = str(destination)
        document.task_id = enqueue_document(document)
        document.save(update_fields=['storage_path', 'task_id', 'updated_at'])

        serializer = UploadAcceptedSerializer(
            {
                'document_id': document.id,
                'task_id': document.task_id,
                'status': document.status,
                'progress': document.progress,
                'stage': document.stage,
            }
        )
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)


class DocumentStatusAPIView(APIView):
    @extend_schema(
        summary="Retrieve Document Status",
        description="Provides the real-time status and progress of an uploaded document's ingestion task.",
        responses={
            status.HTTP_200_OK: UploadedDocumentStatusSerializer,
            status.HTTP_404_NOT_FOUND: OpenApiResponse(description='Document not found'),
        }
    )
    def get(self, request, document_id):
        document = get_object_or_404(UploadedDocument, id=document_id)
        live_status = sync_document_status(document)

        data = UploadedDocumentStatusSerializer(document, context={'message': live_status.get('message', '')}).data
        return Response(data, status=status.HTTP_200_OK)
