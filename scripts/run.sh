#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f SOURCE_COMMIT ]; then
  BUILD_COMMIT="$(cat SOURCE_COMMIT)"
  [[ "$BUILD_COMMIT" =~ ^[a-f0-9]{40}$ ]] || { printf 'Invalid SOURCE_COMMIT\n' >&2; exit 1; }
  if command -v sha256sum >/dev/null; then
    sha256sum -c MANIFEST.sha256 >/dev/null
  else
    shasum -a 256 -c MANIFEST.sha256 >/dev/null
  fi
else
  BUILD_COMMIT="$(git rev-parse HEAD)"
  if [ -n "$(git status --porcelain)" ]; then BUILD_COMMIT="${BUILD_COMMIT}-dirty"; fi
fi
export BUILD_COMMIT
printf 'Milk Tower %s / %s\n' "$(cat VERSION)" "$BUILD_COMMIT"
docker compose up --build -d --wait --wait-timeout 180 "$@"
printf 'Open http://%s\n' "$(docker compose port frontend 8080)"
