#!/usr/bin/env bash
# setup-iap.sh — One-time Identity-Aware Proxy setup for the ArtLens AI Cloud Run service
#
# Configures:
#   - Enables iap.googleapis.com
#   - Creates the OAuth brand "ArtLens AI" (consent screen) if missing
#   - Creates an IAP OAuth client under that brand if missing
#   - Best-effort: applies cookieDomain to the Cloud Run hostname
#
# Safe to re-run. Existing brand / client / settings are reused.
#
# Usage:
#   ./setup-iap.sh                    # Auto-detect project + service from .env / gcloud config
#   ./setup-iap.sh --project ID       # Override project
#   ./setup-iap.sh --service NAME     # Override service name
#   ./setup-iap.sh --region REGION    # Override region
#
# Prerequisites: roles/iap.admin, roles/serviceusage.serviceUsageAdmin

set -euo pipefail

# ---------------------------------------------------------------------------
# Load .env if present
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-artlens-ai}"
APP_TITLE="ArtLens AI"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --project)  PROJECT="$2"; shift 2 ;;
    --region)   REGION="$2"; shift 2 ;;
    --service)  SERVICE_NAME="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "${PROJECT}" ]]; then
  echo "ERROR: No project set. Use --project or set GOOGLE_CLOUD_PROJECT in .env."
  exit 1
fi

echo "============================================"
echo "  ArtLens AI — IAP One-Time Setup"
echo "============================================"
echo "  Project:  ${PROJECT}"
echo "  Region:   ${REGION}"
echo "  Service:  ${SERVICE_NAME}"
echo ""

# ---------------------------------------------------------------------------
# 1. Enable IAP API
# ---------------------------------------------------------------------------
echo ">>> Enabling iap.googleapis.com..."
gcloud services enable iap.googleapis.com --project="${PROJECT}" --quiet
echo "    OK"
echo ""

# ---------------------------------------------------------------------------
# 2. OAuth brand (consent screen)
# ---------------------------------------------------------------------------
echo ">>> Checking OAuth brand..."
EXISTING_BRAND=$(gcloud iap oauth-brands list \
  --project="${PROJECT}" \
  --format="value(name)" 2>/dev/null | head -1 || true)

if [[ -n "${EXISTING_BRAND}" ]]; then
  BRAND="${EXISTING_BRAND}"
  echo "    Reusing existing brand: ${BRAND}"
else
  SUPPORT_EMAIL=$(gcloud config get-value account 2>/dev/null || true)
  if [[ -z "${SUPPORT_EMAIL}" ]]; then
    echo "ERROR: Could not determine support email. Run 'gcloud auth login' first."
    exit 1
  fi
  echo "    Creating brand '${APP_TITLE}' with support email ${SUPPORT_EMAIL}..."
  BRAND=$(gcloud iap oauth-brands create \
    --project="${PROJECT}" \
    --application_title="${APP_TITLE}" \
    --support_email="${SUPPORT_EMAIL}" \
    --format="value(name)")
  echo "    Created brand: ${BRAND}"
fi
echo ""

# ---------------------------------------------------------------------------
# 3. OAuth client for IAP
# ---------------------------------------------------------------------------
echo ">>> Checking IAP OAuth client..."
EXISTING_CLIENT=$(gcloud iap oauth-clients list "${BRAND}" \
  --project="${PROJECT}" \
  --format="value(name)" 2>/dev/null | head -1 || true)

if [[ -n "${EXISTING_CLIENT}" ]]; then
  CLIENT="${EXISTING_CLIENT}"
  echo "    Reusing existing OAuth client: ${CLIENT}"
else
  echo "    Creating new OAuth client..."
  CLIENT=$(gcloud iap oauth-clients create "${BRAND}" \
    --project="${PROJECT}" \
    --display_name="${APP_TITLE} IAP Client" \
    --format="value(name)")
  echo "    Created client: ${CLIENT}"
fi
CLIENT_ID="${CLIENT##*/}"
echo ""

# ---------------------------------------------------------------------------
# 4. Resolve Cloud Run hostname
# ---------------------------------------------------------------------------
echo ">>> Looking up Cloud Run hostname for ${SERVICE_NAME}..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --format="value(status.url)" 2>/dev/null || true)

if [[ -z "${SERVICE_URL}" ]]; then
  echo "    Service not yet deployed in ${REGION}."
  echo "    Run ./deploy.sh, then re-run ./setup-iap.sh to apply cookieDomain."
  HOSTNAME=""
else
  HOSTNAME="${SERVICE_URL#https://}"
  HOSTNAME="${HOSTNAME#http://}"
  echo "    Hostname: ${HOSTNAME}"
fi
echo ""

# ---------------------------------------------------------------------------
# 5. Best-effort: cookieDomain via gcloud iap settings set
# ---------------------------------------------------------------------------
if [[ -n "${HOSTNAME}" ]]; then
  echo ">>> Applying cookieDomain (best-effort)..."
  TMP_SETTINGS=$(mktemp)
  trap 'rm -f "${TMP_SETTINGS}"' EXIT

  cat > "${TMP_SETTINGS}" <<EOF
applicationSettings:
  cookieDomain: ${HOSTNAME}
EOF
  if gcloud iap settings set "${TMP_SETTINGS}" \
      --project="${PROJECT}" \
      --resource-type=cloud-run \
      --service="${SERVICE_NAME}" \
      --region="${REGION}" \
      --quiet 2>/dev/null; then
    echo "    OK (cookieDomain=${HOSTNAME})"
  else
    echo "    Per-host cookieDomain rejected; trying run.app fallback..."
    cat > "${TMP_SETTINGS}" <<EOF
applicationSettings:
  cookieDomain: run.app
EOF
    if gcloud iap settings set "${TMP_SETTINGS}" \
        --project="${PROJECT}" \
        --resource-type=cloud-run \
        --service="${SERVICE_NAME}" \
        --region="${REGION}" \
        --quiet 2>/dev/null; then
      echo "    OK (cookieDomain=run.app)"
    else
      echo "    NOTE: cookieDomain not applied. IAP will still function with default scoping."
    fi
  fi
  echo ""
fi

# ---------------------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------------------
echo "============================================"
echo "  IAP Setup Complete"
echo "============================================"
echo "  Brand:     ${BRAND}"
echo "  Client ID: ${CLIENT_ID}"
echo "  Hostname:  ${HOSTNAME:-<deploy first, then re-run>}"
echo ""
echo "Next steps:"
echo "  1. ./deploy.sh           # Deploy (or re-deploy) the service with IAP enabled"
echo "  2. ./configure-iap.sh    # Grant google.com domain access (default)"
echo ""
