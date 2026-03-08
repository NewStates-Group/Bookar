#!/bin/sh

python manage.py migrate --noinput

gunicorn core.asgi:application --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
