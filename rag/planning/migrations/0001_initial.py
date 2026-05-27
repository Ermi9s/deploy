"""
Initial migration for the planning app.

Creates:
  - planning_plan
  - planning_milestone
  - planning_planningnotification
"""
from __future__ import annotations

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Plan',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('department_id', models.CharField(db_index=True, max_length=100)),
                ('created_by_user_id', models.PositiveIntegerField(db_index=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Milestone',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('due_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[
                        ('open', 'Open'),
                        ('auto_completed', 'Auto Completed'),
                        ('manually_completed', 'Manually Completed'),
                    ],
                    db_index=True,
                    default='open',
                    max_length=30,
                )),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('completion_summary', models.TextField(blank=True)),
                ('completion_confidence', models.CharField(
                    blank=True,
                    choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')],
                    max_length=10,
                )),
                ('reference_document_id', models.CharField(blank=True, max_length=255)),
                ('reference_filename', models.CharField(blank=True, max_length=512)),
                ('rejected_document_ids', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('plan', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='milestones',
                    to='planning.plan',
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
        migrations.CreateModel(
            name='PlanningNotification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id', models.PositiveIntegerField(db_index=True)),
                ('message', models.TextField()),
                ('is_read', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('milestone', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to='planning.milestone',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='plan',
            index=models.Index(fields=['department_id', 'is_active'], name='planning_pl_dept_active_idx'),
        ),
        migrations.AddIndex(
            model_name='milestone',
            index=models.Index(fields=['plan', 'status'], name='planning_ms_plan_status_idx'),
        ),
        migrations.AddIndex(
            model_name='planningnotification',
            index=models.Index(fields=['user_id', 'is_read'], name='planning_nt_user_read_idx'),
        ),
    ]
