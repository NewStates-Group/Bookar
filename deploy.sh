#!/bin/bash
set -e

# Logar no Docker (se precisar)
# echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin

docker compose -f docker-compose.prod.yml pull

docker compose -f docker-compose.prod.yml down

docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

docker image prune -f

echo "Deploy finished!"