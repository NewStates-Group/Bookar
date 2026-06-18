#!/bin/sh

if [ "$WORKER" = "True" ]; then
    echo "Starting Celery worker"

    exec newrelic-admin run-program \
        celery -A core worker --loglevel=info --concurrency=4
fi

echo "Applying migrations"
python manage.py migrate --noinput

echo "Seeding plans"
python manage.py seed_plans

echo "Starting Gunicorn (DEBUG=$DEBUG)"

if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "1" ]; then
    exec watchmedo auto-restart --directory=. --pattern="*.py" --recursive -- uvicorn core.asgi:application \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 4
else
    exec newrelic-admin run-program \
        uvicorn core.asgi:application \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 4
fi