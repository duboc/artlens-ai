#!/usr/bin/env bash
# setup.sh — ArtLens AI GCP Project Bootstrap
# Automates GCP resource provisioning for local development.
# Safe to run multiple times (idempotent).
#
# Usage: ./setup.sh [--project ID] [--region REGION] [--bucket NAME]

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✔${RESET} $1"; }
skip() { echo -e "  ${YELLOW}→${RESET} $1"; }
fail() { echo -e "  ${RED}✖${RESET} $1"; }
info() { echo -e "  $1"; }

# ─── Defaults ────────────────────────────────────────────────────────────────
PROJECT_ID=""
REGION="us-central1"
BUCKET=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.local"
SUMMARY_CREATED=()
SUMMARY_SKIPPED=()

# ─── Parse arguments ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --region)  REGION="$2";     shift 2 ;;
    --bucket)  BUCKET="$2";    shift 2 ;;
    --help|-h)
      echo "Usage: ./setup.sh [--project ID] [--region REGION] [--bucket NAME]"
      echo ""
      echo "Options:"
      echo "  --project ID      GCP project ID (default: from gcloud config)"
      echo "  --region REGION   GCP region (default: us-central1)"
      echo "  --bucket NAME     GCS bucket name (default: \${PROJECT_ID}-artlens-media)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Functions ───────────────────────────────────────────────────────────────

check_prerequisites() {
  echo ""
  echo -e "${BOLD}Checking prerequisites...${RESET}"

  # Check gcloud CLI
  if ! command -v gcloud &>/dev/null; then
    fail "gcloud CLI not found. Install it from https://cloud.google.com/sdk/docs/install"
    exit 1
  fi
  ok "gcloud CLI installed"

  # Check authentication
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1 | grep -q "."; then
    fail "Not authenticated. Run: gcloud auth login"
    exit 1
  fi
  local account
  account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
  ok "Authenticated as ${account}"
}

resolve_project() {
  echo ""
  echo -e "${BOLD}Resolving GCP project...${RESET}"

  # 1. From --project flag
  if [[ -n "${PROJECT_ID}" ]]; then
    ok "Using project from --project flag: ${PROJECT_ID}"
    return
  fi

  # 2. From gcloud config
  local configured
  configured=$(gcloud config get-value project 2>/dev/null || true)
  if [[ -n "${configured}" && "${configured}" != "(unset)" ]]; then
    PROJECT_ID="${configured}"
    ok "Using project from gcloud config: ${PROJECT_ID}"
    return
  fi

  # 3. Interactive prompt
  echo ""
  echo "  No project configured. Available projects:"
  gcloud projects list --format="value(projectId)" 2>/dev/null | head -10 | while read -r p; do
    echo "    - ${p}"
  done
  echo ""
  read -rp "  Enter GCP project ID: " PROJECT_ID
  if [[ -z "${PROJECT_ID}" ]]; then
    fail "Project ID is required"
    exit 1
  fi
  ok "Using project: ${PROJECT_ID}"
}

enable_apis() {
  echo ""
  echo -e "${BOLD}Enabling APIs...${RESET}"

  local apis=(
    "aiplatform.googleapis.com"
    "firestore.googleapis.com"
    "storage.googleapis.com"
  )

  for api in "${apis[@]}"; do
    # Check if already enabled
    if gcloud services list --enabled --project="${PROJECT_ID}" --format="value(config.name)" 2>/dev/null | grep -q "^${api}$"; then
      skip "${api} already enabled"
      SUMMARY_SKIPPED+=("API: ${api}")
    else
      gcloud services enable "${api}" --project="${PROJECT_ID}" --quiet
      ok "${api} enabled"
      SUMMARY_CREATED+=("API: ${api}")
    fi
  done
}

create_firestore() {
  echo ""
  echo -e "${BOLD}Setting up Firestore...${RESET}"

  # Check if Firestore database exists
  if gcloud firestore databases describe --project="${PROJECT_ID}" --database="(default)" &>/dev/null; then
    skip "Firestore (default) database already exists"
    SUMMARY_SKIPPED+=("Firestore (default) database")
  else
    gcloud firestore databases create \
      --project="${PROJECT_ID}" \
      --location="${REGION}" \
      --type=firestore-native \
      --quiet 2>/dev/null || {
        # If creation fails, it might already exist with a different mode
        if gcloud firestore databases describe --project="${PROJECT_ID}" --database="(default)" &>/dev/null; then
          skip "Firestore (default) database already exists (different mode)"
          SUMMARY_SKIPPED+=("Firestore (default) database")
          return
        fi
        fail "Failed to create Firestore database"
        exit 1
      }
    ok "Firestore (default) database created in ${REGION} (Native mode)"
    SUMMARY_CREATED+=("Firestore (default) database")
  fi
}

create_storage_bucket() {
  echo ""
  echo -e "${BOLD}Setting up Cloud Storage...${RESET}"

  # Default bucket name
  if [[ -z "${BUCKET}" ]]; then
    BUCKET="${PROJECT_ID}-artlens-media"
  fi

  # Check if bucket exists
  if gcloud storage buckets describe "gs://${BUCKET}" --project="${PROJECT_ID}" &>/dev/null; then
    skip "Bucket gs://${BUCKET} already exists"
    SUMMARY_SKIPPED+=("Cloud Storage bucket: ${BUCKET}")
  else
    gcloud storage buckets create "gs://${BUCKET}" \
      --project="${PROJECT_ID}" \
      --location="${REGION}" \
      --uniform-bucket-level-access \
      --quiet
    ok "Bucket gs://${BUCKET} created in ${REGION} (uniform access)"
    SUMMARY_CREATED+=("Cloud Storage bucket: ${BUCKET}")
  fi
}

setup_adc() {
  echo ""
  echo -e "${BOLD}Checking Application Default Credentials...${RESET}"

  local adc_path="${HOME}/.config/gcloud/application_default_credentials.json"
  if [[ -f "${adc_path}" ]]; then
    skip "ADC credentials already configured"
    SUMMARY_SKIPPED+=("Application Default Credentials")
  else
    echo "  ADC credentials not found. Opening browser for authentication..."
    echo ""
    gcloud auth application-default login --quiet
    if [[ -f "${adc_path}" ]]; then
      ok "ADC credentials configured"
      SUMMARY_CREATED+=("Application Default Credentials")
    else
      fail "ADC setup may have failed — check manually with: gcloud auth application-default print-access-token"
    fi
  fi
}

write_env_file() {
  echo ""
  echo -e "${BOLD}Writing .env.local...${RESET}"

  # Check if .env.local already exists
  if [[ -f "${ENV_FILE}" ]]; then
    echo ""
    read -rp "  .env.local already exists. Overwrite? [y/N] " answer
    if [[ "${answer}" != "y" && "${answer}" != "Y" ]]; then
      skip ".env.local not overwritten"
      SUMMARY_SKIPPED+=(".env.local file")
      return
    fi
  fi

  local today
  today=$(date +%Y-%m-%d)

  cat > "${ENV_FILE}" <<EOF
# ArtLens AI — Generated by setup.sh on ${today}
GOOGLE_CLOUD_PROJECT=${PROJECT_ID}
GCS_BUCKET=${BUCKET}
FIRESTORE_DATABASE=(default)
PORT=3001
EOF

  ok ".env.local written"
  SUMMARY_CREATED+=(".env.local file")
}

print_summary() {
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  Setup Complete${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

  if [[ ${#SUMMARY_CREATED[@]} -gt 0 ]]; then
    echo ""
    echo -e "  ${GREEN}Created:${RESET}"
    for item in "${SUMMARY_CREATED[@]}"; do
      echo -e "    ${GREEN}✔${RESET} ${item}"
    done
  fi

  if [[ ${#SUMMARY_SKIPPED[@]} -gt 0 ]]; then
    echo ""
    echo -e "  ${YELLOW}Already existed (skipped):${RESET}"
    for item in "${SUMMARY_SKIPPED[@]}"; do
      echo -e "    ${YELLOW}→${RESET} ${item}"
    done
  fi

  echo ""
  echo -e "  ${BOLD}Project:${RESET}   ${PROJECT_ID}"
  echo -e "  ${BOLD}Region:${RESET}    ${REGION}"
  echo -e "  ${BOLD}Bucket:${RESET}    ${BUCKET}"
  echo -e "  ${BOLD}Env file:${RESET}  ${ENV_FILE}"

  echo ""
  echo -e "  ${BOLD}Next steps:${RESET}"
  echo "    1. npm install"
  echo "    2. npm run dev"
  echo "    3. Open http://localhost:3000"
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}🎨 ArtLens AI — GCP Project Setup${RESET}"

check_prerequisites
resolve_project
enable_apis
create_firestore
create_storage_bucket
setup_adc
write_env_file
print_summary
