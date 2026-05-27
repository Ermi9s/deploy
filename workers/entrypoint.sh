#!/bin/sh
set -e

cd /app

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

: "${CELERY_APP:=workers}"
: "${CELERY_LOGLEVEL:=info}"
: "${CELERY_QUEUES:=document_ingestion_jobs,default}"
: "${CELERY_BEAT:=true}"

if [ "$CELERY_BEAT" = "true" ]; then
  exec celery -A "$CELERY_APP" worker -B --loglevel="$CELERY_LOGLEVEL" --queues="$CELERY_QUEUES"
fi

exec celery -A "$CELERY_APP" worker --loglevel="$CELERY_LOGLEVEL" --queues="$CELERY_QUEUES"
