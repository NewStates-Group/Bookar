#!/bin/bash
set -e

echo "Pulling images..."
docker compose pull

echo "Rebuilding..."
docker compose build

echo "Updating workers one by one..."

workers=$(docker ps --filter "name=worker" --format "{{.Names}}")

for worker in $workers; do
    echo "Updating $worker..."

    docker stop $worker
    docker rm $worker

    docker compose up -d --no-deps --build worker

    echo "Waiting before next worker..."
    sleep 10
done

echo "Cleaning old Docker stuff..."
docker image prune -f
docker builder prune -f --filter "until=24h"


echo "Reloading nginx..."
sudo nginx -s reload

echo "Deploy finished!"
