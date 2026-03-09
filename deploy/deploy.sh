#!/bin/bash
set -e

# Logar no Docker (se precisar)
# echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin

docker compose pull

docker compose down

docker compose up -d --build --remove-orphans

docker image prune -f

echo "Deploy finished!"