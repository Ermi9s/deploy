from django.urls import path

from .views import (
    CreateFolderAPIView,
    DeleteItemAPIView,
    DriveItemListAPIView,
    RegisterUploadedDocumentAPIView,
    RenameItemAPIView,
    MoveItemAPIView,
    RestoreItemAPIView,
    TrashListAPIView,
)

urlpatterns = [
    path('', DriveItemListAPIView.as_view(), name='drive-list'),
    path('create_folder/', CreateFolderAPIView.as_view(), name='drive-create-folder'),
    path('upload_document/', RegisterUploadedDocumentAPIView.as_view(), name='drive-upload-document'),
    path('trash/', TrashListAPIView.as_view(), name='drive-trash'),
    path('<uuid:item_id>/rename/', RenameItemAPIView.as_view(), name='drive-rename-item'),
    path('<uuid:item_id>/move/', MoveItemAPIView.as_view(), name='drive-move-item'),
    path('<uuid:item_id>/delete_item/', DeleteItemAPIView.as_view(), name='drive-delete-item'),
    path('<uuid:item_id>/restore/', RestoreItemAPIView.as_view(), name='drive-restore-item'),
]
