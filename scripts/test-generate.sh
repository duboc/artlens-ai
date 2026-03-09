#!/usr/bin/env bash
# Test: POST /api/generate (Vertex AI text generation proxy)
# Requires a valid user. Pass USER_ID env var or it creates one.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"

do_request() {
  local method="$1" url="$2"; shift 2
  local http_code
  http_code=$(curl -s -o /tmp/artlens_response.json -w "%{http_code}" -X "$method" "$@" "$url")
  echo "HTTP $http_code"
}

# Create a user if not provided
if [ -z "${USER_ID:-}" ]; then
  echo "=== Creating test user ==="
  do_request POST "$BASE_URL/api/users" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@test.com","persona":"guide","language":"en"}'
  USER_ID=$(jq -r '.userId' /tmp/artlens_response.json)
  echo "userId: $USER_ID"
  echo ""
fi

echo "=== POST /api/generate (simple text prompt) ==="
do_request POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "What is the Mona Lisa? Reply in one sentence."}]
      }
    ]
  }'
jq '{text: .text}' /tmp/artlens_response.json
echo ""

echo "=== POST /api/generate (with JSON response mode) ==="
do_request POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Name 3 famous paintings. Return as JSON array of strings."}]
      }
    ],
    "generationConfig": {
      "responseMimeType": "application/json"
    }
  }'
jq '{text: .text}' /tmp/artlens_response.json
echo ""

echo "=== POST /api/generate (with search grounding) ==="
do_request POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Who painted Guernica and when? Reply briefly."}]
      }
    ],
    "tools": [{"google_search": {}}]
  }'
jq '{text: .text}' /tmp/artlens_response.json
echo ""

echo "=== POST /api/generate (no auth → 401) ==="
do_request POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "hello"}]}]}'
jq . /tmp/artlens_response.json
