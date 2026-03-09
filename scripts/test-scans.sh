#!/usr/bin/env bash
# Test: Scan and Chat endpoints
# Requires USER_ID env var or creates one.
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

# Create a user if not provided
if [ -z "${USER_ID:-}" ]; then
  echo "=== Creating test user ==="
  curl -s -o /tmp/artlens_response.json \
    -X POST "$BASE_URL/api/users" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@test.com","persona":"guide","language":"en"}'
  USER_ID=$(jq -r '.userId' /tmp/artlens_response.json)
  echo "userId: $USER_ID"
  echo ""
fi

echo "=== POST /api/scans (create scan) ==="
do_request POST "$BASE_URL/api/scans" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{
    "artData": {
      "title": "Guernica",
      "artist": "Pablo Picasso",
      "year": "1937",
      "country": "Spain",
      "style": "Cubism",
      "description": "Anti-war painting depicting the bombing of Guernica.",
      "funFact": "The painting is 3.49m tall and 7.76m wide."
    },
    "language": "en"
  }'

SCAN_ID=$(jq -r '.scanId' /tmp/artlens_response.json)
echo "Created scanId: $SCAN_ID"

echo ""
echo "=== GET /api/users/$USER_ID/scans (list scans) ==="
do_request GET "$BASE_URL/api/users/$USER_ID/scans" \
  -H "X-User-Id: $USER_ID"

echo "=== PATCH /api/scans/$SCAN_ID/deep-analysis ==="
do_request PATCH "$BASE_URL/api/scans/$SCAN_ID/deep-analysis" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{
    "deepAnalysis": {
      "historicalContext": "Painted during the Spanish Civil War.",
      "technicalAnalysis": "Oil on canvas, monochromatic palette.",
      "symbolism": "The bull represents brutality, the horse represents the people.",
      "curiosities": ["Picasso refused to let it return to Spain until democracy was restored."]
    }
  }'

echo "=== POST /api/scans/$SCAN_ID/chats (save user message) ==="
do_request POST "$BASE_URL/api/scans/$SCAN_ID/chats" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{"role": "user", "text": "Tell me more about the symbolism in this painting."}'

echo "=== POST /api/scans/$SCAN_ID/chats (save model response) ==="
do_request POST "$BASE_URL/api/scans/$SCAN_ID/chats" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{"role": "model", "text": "The bull in Guernica represents brutality and darkness..."}'

echo "=== GET /api/scans/$SCAN_ID/chats (load chat history) ==="
do_request GET "$BASE_URL/api/scans/$SCAN_ID/chats" \
  -H "X-User-Id: $USER_ID"

echo "=== POST /api/scans/$SCAN_ID/chats (validation: bad role → 400) ==="
do_request POST "$BASE_URL/api/scans/$SCAN_ID/chats" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{"role": "admin", "text": "should fail"}'
