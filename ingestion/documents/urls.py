from django.urls import path

from .views import DocumentStatusAPIView, UploadDocumentAPIView

urlpatterns = [
    path('upload/', UploadDocumentAPIView.as_view(), name='upload-document'),
    path('<uuid:document_id>/status/', DocumentStatusAPIView.as_view(), name='document-status'),
]
