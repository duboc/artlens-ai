# IAP for Cloud Run — Implementation Plan

Add Identity-Aware Proxy as the access gate in front of the deployed Cloud Run service. IAP is the **only** access layer; the existing `X-User-Id` UUID flow stays untouched and continues to handle app-level identity.

**Decisions (locked in):**
- Auth model: keep `X-User-Id` as-is; IAP only gates network access.
- Audience: `domain:google.com` only (matches Nano Banana default).
- Test scripts: must keep working against the deployed URL via `gcloud auth print-identity-token`.
- `/ws/live` WebSocket: no code change — browser same-origin WS carries the IAP cookie automatically.

## 1. Create `setup-iap.sh` (one-time per project)
- [x] 1.1 In `setup-iap.sh` at project root, enable `iap.googleapis.com`, idempotently create an OAuth brand titled `"ArtLens AI"` (support email = current `gcloud` account, internal app type), then create an IAP OAuth client under that brand.
- [x] 1.2 In `setup-iap.sh`, fetch the deployed Cloud Run hostname for `${CLOUD_RUN_SERVICE:-artlens-ai}` in `${CLOUD_RUN_REGION:-us-central1}` and apply it to IAP allowed domains via `gcloud iap settings set`, with a fallback to the bare `run.app` suffix if the per-host setting is rejected.
- [x] 1.3 Make the script idempotent: skip brand/client creation if they already exist; print a summary at the end (brand name, client ID, hostname).

## 2. Create `configure-iap.sh` (manage access)
- [x] 2.1 In `configure-iap.sh` at project root, support flags `--project`, `--region`, `--service`, `--domain`, `--user`, `--remove`, `--status`, mirroring the Nano Banana script. Default `DOMAIN=google.com`, default service `artlens-ai`.
- [x] 2.2 In `configure-iap.sh`, implement the add/remove flow against `roles/iap.httpsResourceAccessor` using `gcloud iap web add-iam-policy-binding` / `remove-iam-policy-binding` with `--resource-type=cloud-run --service="${SERVICE_NAME}" --region="${REGION}"`.
- [x] 2.3 In `configure-iap.sh`, support `--status` to dump the current IAP IAM policy via `gcloud iap web get-iam-policy`, and verify IAP is enabled on the service before adding/removing (warn if not).

## 3. Patch `deploy.sh` to enable IAP
- [x] 3.1 In `deploy.sh:73`, replace `--allow-unauthenticated` with `--no-allow-unauthenticated --iap` in the `gcloud run deploy` invocation. Leave all other flags (memory/cpu/concurrency/session-affinity/timeout) intact.
- [x] 3.2 In `deploy.sh`, after the deploy succeeds and before printing the service URL, look up `PROJECT_NUMBER` via `gcloud projects describe` and add a Cloud Run IAM binding granting `roles/run.invoker` to `serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com` (idempotent — `gcloud` returns success on duplicate).
- [x] 3.3 In `deploy.sh`, append a one-line reminder to the final output: if this is a first deploy, run `./setup-iap.sh` then `./configure-iap.sh`; otherwise no follow-up needed.

## 4. Patch `scripts/test-*.sh` to send IAP identity tokens
- [x] 4.1 Create `scripts/_iap-headers.sh` — sourced helper that exports `IAP_HEADER=("-H" "Authorization: Bearer $(gcloud auth print-identity-token)")` when `BASE_URL` is non-localhost, and an empty array otherwise. Cache the token in a shell variable so it is only fetched once per test run.
- [x] 4.2 In `scripts/test-health.sh`, source `_iap-headers.sh` and pass `"${IAP_HEADER[@]}"` to the `curl` call.
- [x] 4.3 In `scripts/test-users.sh`, source `_iap-headers.sh` and inject `"${IAP_HEADER[@]}"` into the `do_request` helper so every curl carries the IAP token. The negative-auth tests (no `X-User-Id` → 401) must still pass through IAP — only the app-level auth header is omitted.
- [x] 4.4 In `scripts/test-generate.sh`, same change as 4.3 (source helper + inject `IAP_HEADER` into `do_request`).
- [x] 4.5 In `scripts/test-scans.sh`, same change as 4.3 (source helper + inject `IAP_HEADER` into `do_request` and the standalone `curl` call at line 20).
- [x] 4.6 In `scripts/test-all.sh`, document at the top that running against a non-localhost `BASE_URL` requires `gcloud auth login` with an account that has `roles/iap.httpsResourceAccessor` on the service.

## 5. Documentation
- [x] 5.1 Add a new `## Identity-Aware Proxy (IAP)` section to `README.md` after the "Environment Variables" section, listing `setup-iap.sh`, `configure-iap.sh`, `deploy.sh` with their roles (mirroring the Nano Banana README table) and a one-paragraph note that IAP is the only access layer while `X-User-Id` continues to be the app identity.
- [x] 5.2 Update `CLAUDE.md` "Backend (Express + WebSocket)" section to add one sentence: "Production access is gated by Cloud IAP; `X-User-Id` is unchanged and continues to identify the app-level user inside the IAP perimeter."

## 6. Verification
- [x] 6.1 Run `bash -n setup-iap.sh configure-iap.sh deploy.sh scripts/_iap-headers.sh scripts/test-*.sh` to syntax-check every modified shell script.
- [x] 6.2 Manually run `./scripts/test-health.sh` against `BASE_URL=http://localhost:3001` to confirm the IAP-header path is a no-op locally and existing local tests still pass.

---

## Critique (gaps and risks reviewed before execution)

- **gcloud version** — the `--iap` flag on `gcloud run deploy` requires a recent gcloud CLI. Not gating on a version check; if the deploy fails the error is self-explanatory.
- **OAuth brand creation in `setup-iap.sh`** — fresh projects without any prior OAuth consent screen sometimes need a manual `Internal` vs `External` selection in Cloud Console. The script will surface the underlying `gcloud` error rather than try to fix it.
- **Health probes** — Cloud Run startup/liveness probes hit the container directly (not through IAP), so flipping `--allow-unauthenticated` → `--no-allow-unauthenticated --iap` does not break health checks.
- **CORS and IAP cookies** — `server/index.ts:26-31` sets `credentials: true` and the browser is same-origin to the Cloud Run host, so the IAP cookie rides along. No CORS change required.
- **`POST /api/users` is unauthenticated in the app** — that's fine: IAP gates the network before the request reaches the route, so the only callers are already-authenticated browsers.
- **Test scripts and 401 negative cases** — the "no X-User-Id → 401" tests (e.g. `test-users.sh:54`) must keep the IAP token but drop only the X-User-Id header. The plan's `do_request` injection preserves IAP while leaving X-User-Id selection per call.
- **Localhost vs deployed** — `_iap-headers.sh` keys off `BASE_URL` containing `localhost` or `127.0.0.1` to decide whether to attach the token. No surprise auth attempts when developing locally.
