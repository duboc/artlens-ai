# shellcheck shell=bash
# scripts/_iap-headers.sh — Source this from a test script to populate the
# IAP_HEADER bash array with an Authorization: Bearer header when running
# against a non-localhost BASE_URL.
#
# Caches the token in the IAP_TOKEN env var so children re-source the helper
# without re-running gcloud (test-all.sh fetches once and exports for all).
#
# Usage (in a test script, near the top, AFTER BASE_URL is set):
#   source "$(dirname "$0")/_iap-headers.sh"
#   curl "${IAP_HEADER[@]}" ...
#
# To force a token override (e.g. service-account audience):
#   export IAP_TOKEN="$(gcloud auth print-identity-token --audiences=$IAP_CLIENT_ID)"

# Always initialize so callers can safely expand "${IAP_HEADER[@]}" under set -u.
IAP_HEADER=()

_iap_base="${BASE_URL:-http://localhost:3001}"

# Local development — no IAP in front, no header needed.
if [[ "${_iap_base}" == *"localhost"* || "${_iap_base}" == *"127.0.0.1"* ]]; then
  unset _iap_base
  return 0 2>/dev/null || exit 0
fi

# Remote — fetch (or reuse) an identity token.
if [[ -z "${IAP_TOKEN:-}" ]]; then
  echo "[iap] Fetching IAP identity token via gcloud..." >&2
  IAP_TOKEN="$(gcloud auth print-identity-token 2>/dev/null || true)"
  if [[ -z "${IAP_TOKEN}" ]]; then
    echo "[iap] WARNING: Could not fetch identity token." >&2
    echo "[iap]          Run 'gcloud auth login' with an account that has" >&2
    echo "[iap]          roles/iap.httpsResourceAccessor on the service." >&2
    unset _iap_base
    return 0 2>/dev/null || exit 0
  fi
  export IAP_TOKEN
fi

IAP_HEADER=("-H" "Authorization: Bearer ${IAP_TOKEN}")
unset _iap_base
