#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Building suplr-backend image..."
docker compose build --no-cache

echo "==> Stopping old container (if any)..."
docker compose down --remove-orphans || true

echo "==> Starting new container..."
docker compose up -d

echo "==> Tailing logs (Ctrl-C to detach, container keeps running)..."
docker compose logs -f
