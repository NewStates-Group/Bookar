#!/bin/sh

echo "Applying migrations"
python manage.py migrate --noinput

if [ "$WORKER" = "True" ]; then
    echo "Starting Celery worker"
    exec celery -A core worker --loglevel=info
fi

echo "Starting Gunicorn (DEBUG=$DEBUG)"

if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "1" ]; then
    exec gunicorn core.asgi:application \
        --workers 2 \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:8000 \
        --reload
else
    exec gunicorn core.asgi:application \
        --workers 4 \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:8000
fi