#!/usr/bin/env bash
# Test: GET /health
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"

# shellcheck source=./_iap-headers.sh
source "$(dirname "$0")/_iap-headers.sh"

echo "=== GET /health ==="
HTTP_CODE=$(curl -s -o /tmp/artlens_response.json -w "%{http_code}" "${IAP_HEADER[@]}" "$BASE_URL/health")
echo "HTTP $HTTP_CODE"
jq . /tmp/artlens_response.json
