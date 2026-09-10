#!/bin/bash
set -e

cd /home/ubuntu/projects/suplr/backend

echo "Building suplr-backend..."
docker compose build backend

echo "Restarting container..."
docker compose down
docker compose up -d backend

docker compose logs -f backend
