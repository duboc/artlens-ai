#!/usr/bin/env bash
# Test: User CRUD endpoints
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"

do_request() {
  local method="$1" url="$2"; shift 2
  local http_code
  http_code=$(curl -s -o /tmp/artlens_response.json -w "%{http_code}" -X "$method" "$@" "$url")
  echo "HTTP $http_code"
  jq . /tmp/artlens_response.json
  echo ""
}

echo "=== POST /api/users (create user) ==="
do_request POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","persona":"guide","language":"en"}'

USER_ID=$(jq -r '.userId' /tmp/artlens_response.json)
if [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ]; then
  echo "ERROR: Failed to create user"
  exit 1
fi
echo "Created userId: $USER_ID"

echo ""
echo "=== GET /api/users/$USER_ID (get profile) ==="
do_request GET "$BASE_URL/api/users/$USER_ID" \
  -H "X-User-Id: $USER_ID"

echo "=== PATCH /api/users/$USER_ID (update persona) ==="
do_request PATCH "$BASE_URL/api/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{"persona":"academic"}'

echo "=== GET /api/users/$USER_ID (verify update) ==="
do_request GET "$BASE_URL/api/users/$USER_ID" \
  -H "X-User-Id: $USER_ID"

echo "=== POST /api/users (validation: missing name → 400) ==="
do_request POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","persona":"guide","language":"en"}'

echo "=== POST /api/users (validation: bad persona → 400) ==="
do_request POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{"name":"X","email":"x@x.com","persona":"invalid","language":"en"}'

echo "=== GET /api/users/$USER_ID (no auth → 401) ==="
do_request GET "$BASE_URL/api/users/$USER_ID"

echo "User ID for other tests: $USER_ID"
