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
SUPPORTED_MIME_TYPES = {'application/pdf', *SUPPORTED_IMAGE_MIME_TYPES}


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

        mime_type = upload.content_type or mimetypes.guess_type(upload.name)[0] or 'application/octet-stream'
        if mime_type not in SUPPORTED_MIME_TYPES:
            return Response({'error': f'Unsupported file type: {mime_type}'}, status=status.HTTP_400_BAD_REQUEST)

        # MAC: accept the department permission matrix supplied by the caller.
        # Expected format: JSON object {"<dept-uuid>": <min_ranking_int>, ...}
        import json
        raw_access = request.data.get('departmentAccess', '{}')
        if isinstance(raw_access, str):
            try:
                department_access = json.loads(raw_access)
            except (ValueError, TypeError):
                department_access = {}
        elif isinstance(raw_access, dict):
            department_access = raw_access
        else:
            department_access = {}

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
            extension = '.pdf' if mime_type == 'application/pdf' else '.img'

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
