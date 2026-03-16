#!/bin/bash

# Configuration
DOMAINS="api.bookar.study bookar.study flower.bookar.study"
EMAIL="newstates.bookar@gmail.com"
CERT_PATH="./certbot/conf/live/api.bookar.study"

if [ -d "$CERT_PATH" ]; then
  read -p "Certificates already exist. Do you want to replace them? (y/N) " choice
  if [[ ! $choice =~ ^[Yy]$ ]]; then
    exit 0
  fi
fi

echo "### Requesting Let's Encrypt certificate..."
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL \
    --agree-tos --no-eff-email \
    --force-renewal \
    -d ${DOMAINS// / -d }" certbot

echo "### Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "### Done! You can now uncomment the SSL blocks in nginx.conf if you haven't already."
