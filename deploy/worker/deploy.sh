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

    docker compose stop $worker 2>/dev/null || echo "$worker not running"

    docker rm -f $(docker ps -aq --filter "name=$worker") 2>/dev/null || true

    docker compose up -d --no-deps --build $worker

    sleep 5
done

echo "Cleaning old Docker stuff..."
docker image prune -f || true
docker builder prune -f --filter "until=24h" || true

echo "Reloading nginx..."
if command -v nginx >/dev/null 2>&1; then
    sudo nginx -s reload || echo "Falha ao recarregar nginx"
else
    echo "nginx não está instalado"
fi

echo "Deploy finished!"