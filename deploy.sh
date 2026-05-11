#!/usr/bin/env bash
set -euo pipefail

# ArtLens AI — Cloud Run Deploy Script
# Reads .env and deploys using gcloud run deploy --source

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

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

# ─── Build --set-env-vars ────────────────────────────────────────────────────
# Collect all non-comment, non-empty lines from .env
ENV_PAIRS=""
while IFS= read -r line; do
  # Skip comments and blank lines
  [[ -z "$line" || "$line" == \#* ]] && continue
  # Skip deploy-only vars
  [[ "$line" == CLOUD_RUN_SERVICE=* || "$line" == CLOUD_RUN_REGION=* || "$line" == PORT=* ]] && continue
  if [[ -n "$ENV_PAIRS" ]]; then
    ENV_PAIRS="${ENV_PAIRS},${line}"
  else
    ENV_PAIRS="$line"
  fi
done < "$ENV_FILE"

if [[ -z "${ALLOWED_ORIGINS:-}" ]]; then
  echo "NOTE: ALLOWED_ORIGINS not set. You may want to set it after deploy."
fi

echo "====================================="
echo "  ArtLens AI — Cloud Run Deploy"
echo "====================================="
echo "  Project:  $GOOGLE_CLOUD_PROJECT"
echo "  Service:  $SERVICE_NAME"
echo "  Region:   $DEPLOY_REGION"
echo "  Bucket:   $GCS_BUCKET"
echo "====================================="
echo ""

# ─── Deploy ──────────────────────────────────────────────────────────────────
cd "$PROJECT_ROOT"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$DEPLOY_REGION" \
  --no-allow-unauthenticated \
  --iap \
  --set-env-vars "$ENV_PAIRS" \
  --memory 4Gi \
  --cpu 4 \
  --min-instances 1 \
  --max-instances 5 \
  --concurrency 250 \
  --session-affinity \
  --timeout 300

echo ""
echo "Deploy complete! Fetching service URL..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$DEPLOY_REGION" \
  --format 'value(status.url)')

# ─── Grant IAP service agent permission to invoke Cloud Run ──────────────────
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

echo ""
echo "====================================="
echo "  Service URL: $SERVICE_URL"
echo "====================================="
echo ""
echo "TIP: Add this to your .env to restrict CORS:"
echo "  ALLOWED_ORIGINS=$SERVICE_URL,http://localhost:3000"
echo ""
echo "IAP is enabled. On first deploy, also run:"
echo "  ./setup-iap.sh           # Create OAuth brand + client (one-time)"
echo "  ./configure-iap.sh       # Grant google.com domain access (default)"
