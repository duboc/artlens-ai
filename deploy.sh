#!/usr/bin/env bash
set -euo pipefail

# ArtLens AI — Cloud Run Deploy Script
# Reads .env and deploys using gcloud run deploy --source
#
# Usage:
#   ./deploy.sh           # Public deploy (anyone with the URL can use the app)
#   ./deploy.sh --iap     # Gate the service behind Identity-Aware Proxy
#                         # (then run ./setup-iap.sh and ./configure-iap.sh once)

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

USE_IAP=false
for arg in "$@"; do
  case "$arg" in
    --iap) USE_IAP=true ;;
    -h|--help)
      sed -n '4,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown argument: $arg (see --help)"; exit 1 ;;
  esac
done

# ─── Load .env ───────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  echo "Copy .env.example to .env and fill in your values."
  exit 1
fi

# Source the .env file (exports all variables)
set -a
source "$ENV_FILE"
set +a

# ─── Required variables ──────────────────────────────────────────────────────
if [[ -z "${GOOGLE_CLOUD_PROJECT:-}" ]]; then
  echo "ERROR: GOOGLE_CLOUD_PROJECT not set in .env"
  exit 1
fi

if [[ -z "${GCS_BUCKET:-}" ]]; then
  echo "ERROR: GCS_BUCKET not set in .env"
  exit 1
fi

# ─── Service configuration ───────────────────────────────────────────────────
SERVICE_NAME="${CLOUD_RUN_SERVICE:-artlens-ai}"
DEPLOY_REGION="${CLOUD_RUN_REGION:-us-central1}"
MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-10}"

# ─── Build env-vars file ─────────────────────────────────────────────────────
# Written as YAML so values containing commas (e.g. ALLOWED_ORIGINS) survive;
# --set-env-vars would split them into broken KEY=VALUE pairs.
ENV_VARS_FILE="$(mktemp -t artlens-env.XXXXXX.yaml)"
trap 'rm -f "$ENV_VARS_FILE"' EXIT

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and blank lines
  [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  key="${key#export }"
  # Skip deploy-only vars (and PORT, which Cloud Run sets itself)
  [[ "$key" == CLOUD_RUN_* || "$key" == PORT ]] && continue
  # Use the value as sourced by bash (handles quoting); escape for YAML
  value="${!key-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s: "%s"\n' "$key" "$value" >> "$ENV_VARS_FILE"
done < "$ENV_FILE"

if [[ "$USE_IAP" == true ]]; then
  ACCESS_FLAGS=(--no-allow-unauthenticated --iap)
  ACCESS_LABEL="IAP (restricted)"
else
  ACCESS_FLAGS=(--allow-unauthenticated --no-iap)
  ACCESS_LABEL="PUBLIC (no sign-in)"
fi

EXTRA_FLAGS=()
if [[ -n "${CLOUD_RUN_SERVICE_ACCOUNT:-}" ]]; then
  EXTRA_FLAGS+=(--service-account "$CLOUD_RUN_SERVICE_ACCOUNT")
fi

echo "====================================="
echo "  ArtLens AI — Cloud Run Deploy"
echo "====================================="
echo "  Project:  $GOOGLE_CLOUD_PROJECT"
echo "  Service:  $SERVICE_NAME"
echo "  Region:   $DEPLOY_REGION"
echo "  Bucket:   $GCS_BUCKET"
echo "  Access:   $ACCESS_LABEL"
echo "====================================="
echo ""

# ─── Deploy ──────────────────────────────────────────────────────────────────
cd "$PROJECT_ROOT"

# Notes:
# - --timeout 3600: Cloud Run's request timeout also caps WebSocket lifetime;
#   Live voice sessions can last up to 15 min (server/ws/live.ts).
# - --session-affinity keeps a visitor's WebSocket and HTTP calls on one instance.
# - The server is an I/O-bound proxy (single Node process), so 2 vCPU / 2Gi
#   per instance is plenty; scale out with --max-instances instead.
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$DEPLOY_REGION" \
  "${ACCESS_FLAGS[@]}" \
  ${EXTRA_FLAGS[@]+"${EXTRA_FLAGS[@]}"} \
  --env-vars-file "$ENV_VARS_FILE" \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances "$MAX_INSTANCES" \
  --concurrency 80 \
  --session-affinity \
  --timeout 3600

echo ""
echo "Deploy complete! Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$DEPLOY_REGION" \
  --format 'value(status.url)')

if [[ "$USE_IAP" == true ]]; then
  # ─── Grant IAP service agent permission to invoke Cloud Run ────────────────
  # Without this binding, IAP authenticates users but Cloud Run rejects the
  # forwarded request with 403. Idempotent — safe to re-run on every deploy.
  echo ""
  echo "Granting roles/run.invoker to the IAP service agent..."
  PROJECT_NUMBER=$(gcloud projects describe "$GOOGLE_CLOUD_PROJECT" \
    --format='value(projectNumber)')
  IAP_SA="service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com"

  gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
    --project "$GOOGLE_CLOUD_PROJECT" \
    --region "$DEPLOY_REGION" \
    --member="serviceAccount:${IAP_SA}" \
    --role="roles/run.invoker" \
    --condition=None \
    --quiet > /dev/null
fi

echo ""
echo "====================================="
echo "  Service URL: $SERVICE_URL"
echo "  Access:      $ACCESS_LABEL"
echo "====================================="
if [[ "$USE_IAP" == true ]]; then
  echo ""
  echo "IAP is enabled. On first deploy, also run:"
  echo "  ./setup-iap.sh           # Create OAuth brand + client (one-time)"
  echo "  ./configure-iap.sh       # Grant google.com domain access (default)"
fi
