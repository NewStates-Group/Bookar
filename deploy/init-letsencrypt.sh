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

echo "### Creating dummy certificate..."
mkdir -p "$CERT_PATH"
# Use a temporary alpine container to generate a dummy certificate if it doesn't exist
# This avoids needing openssl installed on the host.
docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" alpine sh -c "
  apk add --no-cache openssl && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/api.bookar.study/privkey.pem \
    -out /etc/letsencrypt/live/api.bookar.study/fullchain.pem \
    -subj '/CN=localhost'"

echo "### Starting nginx..."
docker compose up -d nginx

echo "### Requesting real Let's Encrypt certificate..."
# We use --force-renewal to overwrite our dummy certificate
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL \
    --agree-tos --no-eff-email \
    --force-renewal \
    -d ${DOMAINS// / -d }" certbot

echo "### Reloading nginx with real certificates..."
docker compose exec nginx nginx -s reload

echo "### Done! Your site should now be accessible via HTTPS."
