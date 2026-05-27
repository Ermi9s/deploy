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

: "${ASGI_APP:=rag.asgi:application}"
: "${DAPHNE_BIND:=0.0.0.0}"
: "${DAPHNE_PORT:=8000}"

exec daphne -b "$DAPHNE_BIND" -p "$DAPHNE_PORT" "$ASGI_APP"
