from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DriveItem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('item_type', models.CharField(choices=[('file', 'File'), ('folder', 'Folder')], max_length=20)),
                ('mime_type', models.CharField(blank=True, max_length=255)),
                ('file_size', models.PositiveBigIntegerField(default=0)),
                ('storage_path', models.CharField(blank=True, max_length=1024)),
                ('source_document_id', models.UUIDField(blank=True, null=True, unique=True)),
                ('task_id', models.CharField(blank=True, max_length=255)),
                ('is_trashed', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='drive_items', to=settings.AUTH_USER_MODEL)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='children', to='drive.driveitem')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='driveitem',
            index=models.Index(fields=['owner', 'parent', 'is_trashed'], name='drive_drivei_owner_i_61e7fb_idx'),
        ),
        migrations.AddIndex(
            model_name='driveitem',
            index=models.Index(fields=['owner', 'item_type', 'is_trashed'], name='drive_drivei_owner_i_05a2c7_idx'),
        ),
    ]
