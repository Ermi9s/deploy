from django.urls import re_path

from query.consumers import ChatConsumer
from report.consumers import ReportProgressConsumer

websocket_urlpatterns = [
    re_path(r"^ws/chat/$", ChatConsumer.as_asgi()),
    re_path(r"^ws/report/(?P<job_id>[0-9a-f-]+)/$", ReportProgressConsumer.as_asgi()),
]
