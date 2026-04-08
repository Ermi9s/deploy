FROM python:3.13-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

COPY --chown=app:app . /app
RUN chmod +x /app/entrypoint.sh

ENV DJANGO_WSGI_MODULE=rag.wsgi:application

USER app

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
