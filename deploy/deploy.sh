#!/bin/bash
set -e

# Logar no Docker (se precisar)
# echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin

echo "Stopping containers..."
docker compose down --remove-orphans

echo "Cleaning unused Docker resources..."
docker system prune -af
docker builder prune -af

echo "Pulling images..."
docker compose pull

echo "Starting containers..."
docker compose up -d --build

echo "Restarting Nginx"
sudo systemctl reload nginx

echo "Deploy finished!"