#!/bin/bash
set -e

cd /home/ubuntu/projects/suplr/backend

echo "Building suplr-backend..."
docker compose build backend

echo "Restarting container..."
docker compose up -d backend

echo "Done. Logs:"
docker compose logs --tail=30 backend
