# GCP Setup & Runtime Error Resolution

**Date:** 2026-02-27
**Context:** App runs but backend calls fail — two classes of errors at startup.

---

## Errors Observed

### Error 1: Cloud Storage
```
Upload error: Error: A bucket name is needed to use Cloud Storage.
```
**Where:** `server/services/storage.ts:16` → `getBucket()` called with empty string
**Trigger:** Selfie upload during onboarding, scan image upload after identification
**Impact:** Images not persisted. App continues to work (non-blocking).

### Error 2: Vertex AI API
```
Generate error: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```
**Where:** `server/routes/generate.ts:43` → `vertexResponse.json()` parses HTML instead of JSON
**Trigger:** Every artwork identification call (`POST /api/generate`)
**Impact:** **Critical** — artwork identification fails completely. User sees error after scanning.

---

## Root Cause

Both errors share the same root cause: **missing GCP environment variables**.

The current `.env.local` only has:
```
GEMINI_API_KEY="..."   ← legacy, no longer used since Phase 2 migration
```

It's missing all GCP-related variables. The server defaults to empty strings:
```typescript
// server/config.ts
projectId: process.env.GOOGLE_CLOUD_PROJECT || ''  // ← empty
bucket: process.env.GCS_BUCKET || ''                 // ← empty
```

### Why Error 2 returns HTML

With an empty project ID, the Vertex AI URL becomes malformed:
```
https://global-aiplatform.googleapis.com/v1/projects//locations/global/publishers/google/models/gemini-3-flash-preview:generateContent
                                                     ^^ double slash — invalid
```

Google's API server returns an HTML error page (404 or redirect), which `vertexResponse.json()` can't parse.

---

## Fix Plan

### Step 1: GCP Project Setup (one-time)

```bash
# 1. Set project
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required APIs
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com

# 3. Create Firestore database (Native mode, choose a region)
gcloud firestore databases create --location=us-east1

# 4. Create Cloud Storage bucket
gsutil mb -l us-central1 gs://artlens-ai-media

# 5. Set up Application Default Credentials for local development
gcloud auth application-default login
```

### Step 2: Update `.env.local`

Replace the contents of `.env.local` with:
```env
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
GCS_BUCKET=artlens-ai-media
PORT=3001
```

Remove the old `GEMINI_API_KEY` — it's no longer used (Phase 2 migrated to Vertex AI with ADC).

### Step 3: Harden error handling in backend

The `generate.ts` route crashes when the API returns non-JSON. Add a safe JSON parse:

**File: `server/routes/generate.ts:43`**
```typescript
// Before (crashes on HTML response):
const data: any = await vertexResponse.json();

// After (handles non-JSON gracefully):
const responseText = await vertexResponse.text();
let data: any;
try {
  data = JSON.parse(responseText);
} catch {
  console.error('Vertex AI returned non-JSON:', responseText.slice(0, 200));
  res.status(502).json({ error: 'Vertex AI returned an invalid response. Check GOOGLE_CLOUD_PROJECT env var.' });
  return;
}
```

Apply the same fix in `server/routes/generateImage.ts:63`.

### Step 4: Add graceful fallback for missing config

**File: `server/config.ts`** — add a startup validation warning:

At the bottom of `config.ts`, add:
```typescript
// Warn about missing critical config at startup
if (!config.projectId) {
  console.warn('⚠️  GOOGLE_CLOUD_PROJECT not set — Vertex AI calls will fail');
}
if (!config.bucket) {
  console.warn('⚠️  GCS_BUCKET not set — image uploads will fail');
}
```

### Step 5: Restart and verify

```bash
# Restart the dev server
npm run dev

# In a separate terminal, test the backend
curl -s http://localhost:3001/health | jq .
# Expected: { "status": "ok" }

# Test generate endpoint (should return Vertex AI response, not HTML)
curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -d '{"contents":[{"parts":[{"text":"hello"}]}]}' | head -c 200
```

---

## Verification Checklist

- [ ] `gcloud auth application-default login` completed
- [ ] `GOOGLE_CLOUD_PROJECT` set in `.env.local`
- [ ] `GCS_BUCKET` set in `.env.local`
- [ ] Vertex AI API enabled in GCP project
- [ ] Firestore database created
- [ ] Cloud Storage bucket created
- [ ] `npm run dev` starts without config warnings
- [ ] Artwork scan completes successfully (no "Generate error")
- [ ] Selfie upload succeeds (no "Upload error")
- [ ] Chat (text) works via `/api/generate`
- [ ] Voice chat works via `/ws/live`

---

## Architecture Note

The app is designed to degrade gracefully:
- **If backend is unreachable:** Onboarding completes locally (skip backend user creation), scans work but images aren't persisted
- **If Cloud Storage is unavailable:** Selfie/scan images aren't uploaded, but all other features work
- **If Vertex AI is unavailable:** This is the **critical failure** — artwork identification requires the backend proxy

The `GEMINI_API_KEY` in `.env.local` is a remnant from Phase 1 (before the Vertex AI migration). It's no longer injected into the frontend build (the `vite.config.ts` `define` block was removed in Phase 2). All AI calls now go through the Express proxy using Application Default Credentials.
