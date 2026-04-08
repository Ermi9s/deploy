#!/bin/sh
set -e

cd /app

if [ -f manage.py ]; then
  echo "Running database migrations..."
  python manage.py migrate --noinput

  echo "Collecting static files..."
  python manage.py collectstatic --noinput
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

: "${DJANGO_WSGI_MODULE:=management.wsgi:application}"
: "${GUNICORN_BIND:=0.0.0.0:8000}"
: "${GUNICORN_WORKERS:=3}"
: "${GUNICORN_TIMEOUT:=120}"

exec gunicorn "$DJANGO_WSGI_MODULE" --bind "$GUNICORN_BIND" --workers "$GUNICORN_WORKERS" --timeout "$GUNICORN_TIMEOUT"
