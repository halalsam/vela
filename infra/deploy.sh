#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${1:?usage: deploy.sh <staging|production> <image-tag>}"
IMAGE_TAG="${2:?usage: deploy.sh <staging|production> <image-tag>}"
cd "$(dirname "$0")"

if [[ ! -f "env/${APP_ENV}.env" || ! -f "env/${APP_ENV}.secrets" ]]; then
  echo "missing env/${APP_ENV}.env or env/${APP_ENV}.secrets" >&2
  exit 1
fi

set -a
source "env/${APP_ENV}.secrets"
set +a
export APP_ENV IMAGE_TAG

docker network inspect edge >/dev/null 2>&1 || docker network create edge
docker compose -f compose.yml pull migrate api worker
docker compose -f compose.yml up -d postgres
docker compose -f compose.yml run --rm migrate
docker compose -f compose.yml up -d --remove-orphans api worker
docker image prune -f >/dev/null
echo "deployed ${APP_ENV} at ${IMAGE_TAG}"
