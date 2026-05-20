from django.apps import AppConfig


class UseraccountmanagerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'UserAccountManager'

    def ready(self):
        import UserAccountManager.signals  # noqa: F401 — connects post_migrate receiver
