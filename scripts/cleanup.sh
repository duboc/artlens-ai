#!/usr/bin/env bash
set -euo pipefail

# ArtLens AI — Cleanup Script
# Deletes all user documents from Firestore and all objects from the GCS bucket
# Does NOT delete the Firestore database itself

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

PROJECT="${GOOGLE_CLOUD_PROJECT:-}"
BUCKET="${GCS_BUCKET:-}"

if [[ -z "$PROJECT" ]]; then
  echo "ERROR: GOOGLE_CLOUD_PROJECT not set in .env"
  exit 1
fi
if [[ -z "$BUCKET" ]]; then
  echo "ERROR: GCS_BUCKET not set in .env"
  exit 1
fi

echo "====================================="
echo "  ArtLens AI — Cleanup"
echo "====================================="
echo "  Project:  $PROJECT"
echo "  Bucket:   gs://$BUCKET"
echo "====================================="
echo ""
echo "This will DELETE:"
echo "  - All documents in Firestore 'users' collection (and subcollections)"
echo "  - All objects in gs://$BUCKET"
echo ""
read -p "Are you sure? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

# ─── Clean Firestore (documents only) ────────────────────────────────────────
echo "Deleting Firestore 'users' documents..."
node --input-type=module <<'NODESCRIPT'
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

async function deleteCollection(collectionPath) {
  let totalDeleted = 0;
  while (true) {
    const snapshot = await db.collection(collectionPath).limit(500).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      // Delete subcollections first
      const subcollections = await doc.ref.listCollections();
      for (const sub of subcollections) {
        await deleteCollection(`${collectionPath}/${doc.id}/${sub.id}`);
      }
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snapshot.size;
  }
  return totalDeleted;
}

const deleted = await deleteCollection('users');
console.log(`  Deleted ${deleted} user documents (and subcollections)`);
NODESCRIPT

echo "Firestore cleanup done."
echo ""

# ─── Clean GCS Bucket ────────────────────────────────────────────────────────
echo "Deleting all objects in gs://$BUCKET..."
gcloud storage rm "gs://$BUCKET/**" --quiet 2>/dev/null || {
  echo "  Bucket is already empty or doesn't exist."
}

echo "GCS cleanup done."
echo ""
echo "====================================="
echo "  Cleanup complete!"
echo "====================================="
