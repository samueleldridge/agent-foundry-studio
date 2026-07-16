#!/bin/sh
# Regenerate the OpenAPI types to a temp file and diff against the committed
# copy. Requires the studio control plane to be running (default port 4400;
# override with FOUNDRY_STUDIO_API).
set -eu

API="${FOUNDRY_STUDIO_API:-http://127.0.0.1:4400}"
TMP="$(mktemp -t studio-schema.XXXXXX).d.ts"
trap 'rm -f "$TMP"' EXIT

npx openapi-typescript "$API/api/openapi.json" -o "$TMP" >/dev/null

if diff -q src/api/schema.d.ts "$TMP" >/dev/null; then
  echo "api types: no drift"
else
  echo "api types DRIFT detected — run 'npm run generate:api' and commit:" >&2
  diff -u src/api/schema.d.ts "$TMP" >&2 || true
  exit 1
fi
