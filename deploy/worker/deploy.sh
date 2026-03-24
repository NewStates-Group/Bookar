#!/bin/bash
set -e

echo "Pulling images"
docker compose pull

echo "Rebuilding"
docker compose build

echo "Updating workers one by one..."

workers=("worker1" "worker2" "flower")

for worker in "${workers[@]}"; do
    echo "Updating $worker..."

    docker compose stop $worker 2>/dev/null || echo "not running"

    docker rm -f $(docker ps -aq --filter "name=$worker") 2>/dev/null || echo "Fail to remove" 

    docker compose up -d --build $worker

    sleep 5
done

echo "Cleaning old Docker stuff..."
docker image prune -f
docker builder prune -f --filter "until=24h"

echo "Reloading nginx..."
sudo nginx -s reload

echo "Deploy finished!"