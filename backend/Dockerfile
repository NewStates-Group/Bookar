FROM python:3.12-alpine

WORKDIR /app

RUN apk add --no-cache \
    ffmpeg \
    build-base \
    libffi-dev \
    musl-dev \
    postgresql-dev \
    curl

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]