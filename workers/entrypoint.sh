#!/bin/sh
set -e

cd /app

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

: "${CELERY_APP:=workers}"
: "${CELERY_LOGLEVEL:=info}"
: "${CELERY_QUEUES:=document_ingestion_jobs,default}"

exec celery -A "$CELERY_APP" worker --loglevel="$CELERY_LOGLEVEL" --queues="$CELERY_QUEUES"
