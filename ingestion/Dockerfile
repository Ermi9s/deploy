FROM python:3.13-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --default-timeout=100 --retries=10 --no-cache-dir --upgrade pip \
    && pip install --default-timeout=100 --retries=10 --no-cache-dir -r /app/requirements.txt

COPY --chown=app:app . /app
RUN chmod +x /app/entrypoint.sh

ENV DJANGO_WSGI_MODULE=ingestion.wsgi:application
ENV DJANGO_SETTINGS_MODULE=ingestion.settings

# Generate migrations at build time (runs as root — no permission issues)
RUN python manage.py makemigrations --noinput

USER root

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
