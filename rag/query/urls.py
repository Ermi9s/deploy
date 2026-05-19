from django.urls import path

from .views import QueryAPIView

urlpatterns = [
    path('', QueryAPIView.as_view(), name='query'),
]
