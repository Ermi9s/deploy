FROM python:3.13-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN sed -i 's/https/http/g' /etc/apk/repositories
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    libstdc++

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --default-timeout=100 --retries=10 --no-cache-dir --upgrade pip \
    && pip install --default-timeout=100 --retries=10 --no-cache-dir -r /app/requirements.txt

COPY --chown=app:app . /app
RUN chmod +x /app/entrypoint.sh

USER app

ENTRYPOINT ["/app/entrypoint.sh"]
