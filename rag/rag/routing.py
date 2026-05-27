from django.urls import re_path

from query.consumers import ChatConsumer
from planning.consumers import NotificationConsumer
from report.consumers import ReportProgressConsumer

websocket_urlpatterns = [
    re_path(r"^ws/chat/$", ChatConsumer.as_asgi()),
    re_path(r"^ws/report/(?P<job_id>[0-9a-f-]+)/$", ReportProgressConsumer.as_asgi()),
    re_path(r"^ws/notifications/$", NotificationConsumer.as_asgi()),
]
