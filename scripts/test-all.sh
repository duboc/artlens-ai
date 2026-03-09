#!/usr/bin/env bash
# Run all endpoint tests sequentially
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3001}"

export BASE_URL

echo "========================================"
echo " ArtLens AI — API Endpoint Tests"
echo " Server: $BASE_URL"
echo "========================================"

run_test() {
  local script="$1"
  local name="$2"
  echo ""
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo " $name"
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  bash "$SCRIPT_DIR/$script"
}

run_test "test-health.sh"   "Health Check"
run_test "test-users.sh"    "Users CRUD"
run_test "test-generate.sh" "Vertex AI Generate"
run_test "test-scans.sh"    "Scans & Chats"

echo ""
echo "========================================"
echo " All tests completed!"
echo "========================================"
