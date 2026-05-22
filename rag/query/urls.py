from django.urls import path

from .views import (
    ChatMessageListView,
    ChatSessionDetailView,
    ChatSessionListCreateView,
    QueryAPIView,
)

urlpatterns = [
    # Existing synchronous query endpoint
    path("", QueryAPIView.as_view(), name="query"),

    # Chat session endpoints
    path("chat/sessions/", ChatSessionListCreateView.as_view(), name="chat-session-list-create"),
    path("chat/sessions/<uuid:pk>/", ChatSessionDetailView.as_view(), name="chat-session-detail"),
    path("chat/sessions/<uuid:pk>/messages/", ChatMessageListView.as_view(), name="chat-message-list"),
]
