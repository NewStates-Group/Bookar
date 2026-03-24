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

    if ! docker compose config --services | grep -q "^$worker$"; then
        echo "$worker not in compose, skipping..."
        continue
    fi

    docker compose stop $worker 2>/dev/null

    docker rm -f $(docker ps -aq --filter "name=$worker") 2>/dev/null 

    docker compose up -d --no-deps --build $worker

    sleep 5
done

echo "Cleaning old Docker stuff..."
docker image prune -f
docker builder prune -f --filter "until=24h"

echo "Reloading nginx..."
sudo nginx -s reload

echo "Deploy finished!"