#!/bin/bash
set -e

echo "Pulling images..."
docker compose pull

echo "Rebuilding..."
docker compose build

echo "Updating workers one by one..."

workers=("worker1" "worker2" "flower")

for worker in "${workers[@]}"; do
    echo "Updating $worker..."

    docker compose stop $worker
    docker rm $worker

    docker compose up -d --no-deps --build $worker

    echo "Waiting before next service..."
    sleep 10
done

echo "Cleaning old Docker stuff..."
docker image prune -f
docker builder prune -f --filter "until=24h"

echo "Reloading nginx..."
sudo nginx -s reload

echo "Deploy finished!"
