from django.urls import re_path

from query.consumers import ChatConsumer
from planning.consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r"^ws/chat/$", ChatConsumer.as_asgi()),
    re_path(r"^ws/notifications/$", NotificationConsumer.as_asgi()),
]
