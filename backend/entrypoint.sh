#!/bin/sh

if [ "$WORKER" != "True" ]; then
    echo "Applying migrations"
    python manage.py migrate --noinput
fi

if [ "$WORKER" = "True" ]; then
    echo "Starting Celery worker"

    exec newrelic-admin run-program \
        celery -A core worker --loglevel=info
fi

echo "Starting Gunicorn (DEBUG=$DEBUG)"

if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "1" ]; then
    exec watchmedo auto-restart --directory=. --pattern="*.py" --recursive -- gunicorn core.asgi:application \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --reload
else
    exec newrelic-admin run-program \
         gunicorn core.asgi:application \
        --workers 4 \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:8000
fi