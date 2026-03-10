#!/bin/sh

python manage.py migrate --noinput

if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "1" ]; then
    echo "Starting Gunicorn with --reload"
    exec gunicorn core.asgi:application --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --reload
else
    exec gunicorn core.asgi:application --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
fi

