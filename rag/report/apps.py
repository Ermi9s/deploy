from django.apps import AppConfig


class ReportConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "report"
    label = "rag_report"  # avoids collision if workers service uses 'report' too
