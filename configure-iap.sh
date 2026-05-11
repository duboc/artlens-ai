#!/usr/bin/env bash
# configure-iap.sh — Manage IAP access for the ArtLens AI Cloud Run service
#
# Usage:
#   ./configure-iap.sh                          # Grant google.com domain (default)
#   ./configure-iap.sh --domain example.com     # Grant a different domain
#   ./configure-iap.sh --user user@google.com   # Grant a specific user
#   ./configure-iap.sh --remove                 # Remove access instead of adding
#   ./configure-iap.sh --remove --user u@x.com  # Remove a specific user
#   ./configure-iap.sh --status                 # Show current IAP IAM policy
#
# Prerequisites:
#   - Service deployed with IAP enabled (run ./deploy.sh first)
#   - roles/iap.admin

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
DOMAIN="google.com"
SPECIFIC_USER=""
ACTION="add"
SHOW_STATUS=false

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --project)  PROJECT="$2"; shift 2 ;;
    --region)   REGION="$2"; shift 2 ;;
    --service)  SERVICE_NAME="$2"; shift 2 ;;
    --domain)   DOMAIN="$2"; shift 2 ;;
    --user)     SPECIFIC_USER="$2"; shift 2 ;;
    --remove)   ACTION="remove"; shift ;;
    --status)   SHOW_STATUS=true; shift ;;
    --help|-h)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)          echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "${PROJECT}" ]]; then
  echo "ERROR: No project set. Use --project or set GOOGLE_CLOUD_PROJECT in .env."
  exit 1
fi

echo "============================================"
echo "  ArtLens AI — IAP Access Configuration"
echo "============================================"
echo "  Project:  ${PROJECT}"
echo "  Region:   ${REGION}"
echo "  Service:  ${SERVICE_NAME}"
echo ""

# ---------------------------------------------------------------------------
# --status mode
# ---------------------------------------------------------------------------
if [[ "${SHOW_STATUS}" == true ]]; then
  echo ">>> Current IAP IAM policy:"
  echo ""
  gcloud iap web get-iam-policy \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --resource-type=cloud-run \
    --service="${SERVICE_NAME}"
  exit 0
fi

# ---------------------------------------------------------------------------
# Verify IAP is enabled on the service (warning, not blocking)
# ---------------------------------------------------------------------------
echo ">>> Verifying IAP is enabled on ${SERVICE_NAME}..."
IAP_STATUS=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --format="value(spec.template.metadata.annotations['run.googleapis.com/iap-enabled'])" 2>/dev/null || echo "")

if [[ "${IAP_STATUS}" != "true" ]]; then
  IAP_CHECK=$(gcloud run services describe "${SERVICE_NAME}" \
    --project="${PROJECT}" \
    --region="${REGION}" 2>/dev/null | grep -i "Iap Enabled" || echo "")
  if [[ -z "${IAP_CHECK}" ]]; then
    echo "    WARNING: Could not confirm IAP is enabled. Run ./deploy.sh first."
    echo "             Continuing anyway..."
  else
    echo "    OK"
  fi
else
  echo "    OK"
fi
echo ""

# ---------------------------------------------------------------------------
# Build member string
# ---------------------------------------------------------------------------
if [[ -n "${SPECIFIC_USER}" ]]; then
  MEMBER="user:${SPECIFIC_USER}"
  DESCRIPTION="${SPECIFIC_USER}"
else
  MEMBER="domain:${DOMAIN}"
  DESCRIPTION="all users in ${DOMAIN}"
fi

# ---------------------------------------------------------------------------
# Add or remove
# ---------------------------------------------------------------------------
if [[ "${ACTION}" == "add" ]]; then
  echo ">>> Granting IAP access to ${DESCRIPTION}..."
  echo ""
  gcloud iap web add-iam-policy-binding \
    --project="${PROJECT}" \
    --member="${MEMBER}" \
    --role="roles/iap.httpsResourceAccessor" \
    --region="${REGION}" \
    --resource-type=cloud-run \
    --service="${SERVICE_NAME}" \
    --quiet

  echo ""
  echo "============================================"
  echo "  Access granted"
  echo "============================================"
  echo "  ${DESCRIPTION} can now access the service."
  echo "  Users will be prompted to sign in with their Google account."
  echo ""

elif [[ "${ACTION}" == "remove" ]]; then
  echo ">>> Removing IAP access for ${DESCRIPTION}..."
  echo ""
  gcloud iap web remove-iam-policy-binding \
    --project="${PROJECT}" \
    --member="${MEMBER}" \
    --role="roles/iap.httpsResourceAccessor" \
    --region="${REGION}" \
    --resource-type=cloud-run \
    --service="${SERVICE_NAME}" \
    --quiet

  echo "  Access removed for ${DESCRIPTION}."
  echo ""
fi

# ---------------------------------------------------------------------------
# Final policy
# ---------------------------------------------------------------------------
echo ">>> Current IAP IAM policy:"
echo ""
gcloud iap web get-iam-policy \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --resource-type=cloud-run \
  --service="${SERVICE_NAME}"
