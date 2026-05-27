import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rag.settings")

app = Celery("rag")

# Load CELERY_* settings from Django settings (reads CELERY_BROKER_URL etc.)
# No autodiscover_tasks — the RAG service only dispatches tasks to the workers
# service queue; it does not define or run any Celery tasks itself.
app.config_from_object("django.conf:settings", namespace="CELERY")
