# Implementation Roadmap — ArtLens AI

**Deadline:** March 6, 2026 (code complete) | **Event:** March 18, 2026 (MNAC)
**Today:** March 9, 2026 | **Status:** Code Complete & Refined

---

## Current State

The app is fully functional and migrated to Vertex AI using a backend proxy. All features are complete, including image generation and the virtual gallery. The app has been upgraded to Gemini 3.0 preview models for enhanced performance and search grounding.

| Area | Status |
|------|--------|
| Camera + scan pipeline | Complete (Refined) |
| AI analysis (Gemini 3) | Complete (Vertex AI ADC) |
| Voice chat (Live API) | Complete (Vertex AI ADC) |
| Text chat (Gemini 3) | Complete (Vertex AI ADC) |
| History | Complete (localStorage + Firestore) |
| Annotations | Complete (Vision-based) |
| Font | Google Sans + Google Sans Text |
| Colors | Black + Google Blue `#4285F4` |
| Personas | Classic Guide / Historian / Influencer |
| Onboarding | 3-step wizard (name+email → selfie → persona) |
| Backend proxy | Complete (Express + WebSocket, Vertex AI ADC) |
| Firestore/Storage | Complete (users, scans, images, generated portraits) |
| Core interaction flow | Complete (auto-chat, narration, persona switch, length toggle) |
| Image generation | Complete (Gemini `gemini-2.0-flash-exp`, via backend) |
| Virtual gallery | Complete (grid view + detail overlay + download/share) |

---

## Execution Order

Work is organized into 6 phases. Each phase is self-contained and results in a testable milestone. Phases are ordered by dependency — later phases depend on earlier ones.

---

### Phase 1: Backend Foundation (Cloud Run Proxy) — COMPLETE
**Why first:** Everything else (Vertex AI, persistence, image upload) needs a backend. This is the critical path.

| # | Task | Files | Status |
|---|------|-------|--------|
| 1.1 | Scaffold Express + WS server (unified project) | `server/index.ts`, `server/config.ts`, `server/middleware/` | Done |
| 1.2 | Vertex AI text proxy (`POST /api/generate`) with ADC | `server/routes/generate.ts`, `server/services/vertexai.ts` | Done |
| 1.3 | Vertex AI Live API WebSocket bridge (`/ws/live`) | `server/ws/live.ts` | Done |
| 1.4 | Firestore client + user endpoints (`POST/GET/PATCH /api/users`) | `server/routes/users.ts`, `server/services/firestore.ts` | Done |
| 1.5 | Cloud Storage client + image upload (`POST /api/images/upload`, `GET /api/images/*`) | `server/routes/images.ts`, `server/services/storage.ts` | Done |
| 1.6 | Scan endpoints (`POST /api/scans`, `PATCH deep-analysis`) | `server/routes/scans.ts` | Done |
| 1.7 | Chat endpoints (`POST/GET /api/scans/:id/chats`) | `server/routes/chats.ts` | Done |
| 1.8 | Deploy to Cloud Run, test with `curl` | Dockerfile (not yet created) | Pending |

**Architecture:** Single `package.json` at root. Vite (port 3000) proxies to Express (port 3001) in dev. Express serves `dist/` in production. See `docs/PHASE1_BACKEND_SPEC.md` for full details.

**Milestone:** All code written, TypeScript compiles clean, `npm run build` passes. GCP deployment pending.

**GCP prerequisites (before testing/deploying):**
```
- [ ] GCP project with billing
- [ ] Enable APIs: Vertex AI, Firestore, Cloud Storage, Cloud Run
- [ ] Create Firestore database (Native mode)
- [ ] Create Cloud Storage bucket
- [ ] gcloud auth application-default login (local dev)
```

---

### Phase 2: Frontend → Backend Migration — COMPLETE
**Why second:** Move the frontend off API key auth to use the proxy. No feature changes yet — same behavior, different backend.

| # | Task | Files | Status |
|---|------|-------|--------|
| 2.1 | Create `services/apiClient.ts` (fetch wrapper with `X-User-Id` header) | `services/apiClient.ts` | Done |
| 2.2 | Migrate `geminiService.ts` to route through proxy | `services/geminiService.ts` | Done |
| 2.3 | Migrate `useGeminiChat.ts` to route through proxy | `hooks/useGeminiChat.ts` | Done |
| 2.4 | Migrate `useGeminiLive.ts` to WebSocket proxy | `hooks/useGeminiLive.ts` | Done |
| 2.5 | Update `audioUtils.ts` (remove `@google/genai` Blob import) | `utils/audioUtils.ts` | Done |
| 2.6 | Update env vars + `vite.config.ts` (remove API key injection) | `vite.config.ts` | Done |
| 2.7 | Update WebSocket bridge to inject model resource path | `server/ws/live.ts` | Done |

**Changes:**
- `@google/genai` SDK removed from all frontend code (bundle: 530KB → 261KB)
- `geminiService.ts`: SDK calls → `apiPost('/api/generate')`, `googleSearch`→`googleSearchRetrieval`
- `useGeminiChat.ts`: SDK chat → full conversation history sent to `/api/generate`
- `useGeminiLive.ts`: SDK live → raw WebSocket to `/ws/live` with Vertex AI snake_case format
- `audioUtils.ts`: SDK `Blob` type → local `AudioBlob` interface
- `vite.config.ts`: removed `loadEnv`, `define` block (no more API key)
- `server/ws/live.ts`: proxy injects full model resource path so frontend only sends model name

**Milestone:** App works identically but all AI calls go through Cloud Run proxy. No API key in the browser.

---

### Phase 3: Theming + Persona Rename (P0 + P2) — COMPLETE
**Why third:** Pure frontend changes, no backend dependency. Quick wins that align with the meeting decisions.

| # | Task | Files | Status |
|---|------|-------|--------|
| 3.1 | Replace fonts: DM Serif/DM Sans → Google Sans | `index.html` | Done |
| 3.2 | Replace color palette: Gallery Noir gold → Black + Google Blue | `index.html` (CSS vars + Tailwind config) | Done |
| 3.3 | Update all components to use new palette tokens (hardcoded `#0a0a0a`, gold rgba) | All `components/*.tsx` | Done |
| 3.4 | Rename personas: Guide→Classic Guide, Curator→Historian, Blogger→Influencer | `utils/i18n.ts` | Done |
| 3.5 | Update persona labels in result card + chat window | `components/AnalysisResultCard.tsx`, `components/ChatWindow.tsx` | Done |
| 3.6 | Update persona references in voice system instruction | `hooks/useGeminiLive.ts` | Done |
| 3.7 | Build verification: `tsc --noEmit` + `npm run build` clean | — | Done |

**Changes:**
- Fonts: DM Serif Display + DM Sans → Google Sans + Google Sans Text (Google Fonts)
- Palette: gold `#d4a853` → Google Blue `#4285F4`, background `#0a0a0a` → `#000000`, surface `#161616` → `#1a1a1a`
- All hardcoded `bg-[#0a0a0a]` replaced with `bg-[var(--bg)]` across 8 components
- Gold shadow on annotations → blue shadow
- Persona display names updated in i18n (en/pt/es), voice instructions, chat header
- ChatWindow now shows localized persona label instead of raw internal value

**Milestone:** App branded as Black + Google Blue, personas match meeting spec.

---

### Phase 4: Onboarding + Persistence (P0) — COMPLETE
**Why fourth:** Needs the backend (Phase 1) and the API client (Phase 2) in place.

| # | Task | Files | Status |
|---|------|-------|--------|
| 4.1 | Add `email` to `UserContext` type | `types.ts` | Done |
| 4.2 | Add i18n strings for wizard steps (email, selfie, step indicator) | `utils/i18n.ts` | Done |
| 4.3 | Redesign OnboardingForm as 3-step wizard | `components/OnboardingForm.tsx` | Done |
| 4.4 | Step 1: Name + email input with validation | `components/OnboardingForm.tsx` | Done |
| 4.5 | Step 2: Selfie capture (front camera, circular preview, retake, skip) | `components/OnboardingForm.tsx` | Done |
| 4.6 | Step 3: Persona selection (reused persona cards) | `components/OnboardingForm.tsx` | Done |
| 4.7 | Wire submit: POST /api/users + upload selfie + setUserId | `components/OnboardingForm.tsx` | Done |
| 4.8 | Wire scan: POST /api/scans + upload image on scan complete | `App.tsx` | Done |
| 4.9 | Wire deep analysis: PATCH /api/scans/:id/deep-analysis | `App.tsx` | Done |
| 4.10 | Reset preferences clears userId from localStorage | `App.tsx` | Done |
| 4.11 | Build verification: `tsc --noEmit` + `npm run build` clean | — | Done |

**Changes:**
- `UserContext` now includes `email` field (legacy localStorage data backfilled)
- OnboardingForm: single screen → 3-step wizard with animated progress bar
- Step 2: front camera selfie with circular preview, skip option, retake
- On submit: `POST /api/users` → `setUserId()` → upload selfie (non-blocking) → `onComplete()`
- Quick Start also creates a backend user (guest@artlens.ai)
- `processImageAnalysis()`: after scan, `POST /api/scans` + uploads captured image via FormData
- `executeDeepAnalysis()`: after deep analysis, `PATCH /api/scans/:id/deep-analysis`
- All backend calls are non-blocking with graceful fallback (app works without backend)
- Bundle: 268KB (was 261KB)

**Note:** Chat persistence (4.9 from original plan) and API-based history (4.10) are deferred — localStorage persistence is sufficient for the event scope. Backend wiring for scans and users is the critical path.

**Milestone:** 3-step onboarding (name+email → selfie → persona). User and scan data persisted to Firestore. App degrades gracefully if backend is unavailable.

---

### Phase 5: Core Interaction Flow (P1 + P3) — COMPLETE
**Why fifth:** These are UX improvements on top of the working, persisted flow.

| # | Task | Files | Status |
|---|------|-------|--------|
| 5.1 | Auto-open chat after scan completes (1.5s delay) | `App.tsx` | Done |
| 5.2 | Auto-start voice when chat opens via scan (800ms delay, graceful fallback) | `components/ChatWindow.tsx` | Done |
| 5.3 | Stop narration button (flush audio queue for instant silence) | `components/ChatWindow.tsx`, `hooks/useGeminiLive.ts` | Done |
| 5.4 | Artwork title overlay on frozen camera frame | `App.tsx` | Done |
| 5.5 | Clean close: useEffect cleanup on unmount in useGeminiLive | `hooks/useGeminiLive.ts`, `components/AnalysisResultCard.tsx` | Done |
| 5.6 | Persona switch in chat (dropdown, disconnect + reconnect with new persona) | `components/ChatWindow.tsx`, `App.tsx` | Done |
| 5.7 | Explanation length toggle (Brief/Detailed) in voice bar + text chat | `components/ChatWindow.tsx`, `hooks/useGeminiLive.ts`, `hooks/useGeminiChat.ts` | Done |

**Changes:**
- Scan flow: scan → result card → auto-open chat (1.5s) → auto-start voice (800ms) → narrator speaks
- `stopNarration()` in `useGeminiLive`: flushes all scheduled `AudioBufferSourceNode` for instant silence
- `useGeminiLive` cleanup on unmount: disconnects WebSocket and releases audio streams
- Artwork title overlay: warm-glass pill showing title, artist, year on frozen frame
- Persona switch: clickable label in chat header → dropdown picker, disconnect + reconnect with 300ms delay
- `handlePersonaChange` in `App.tsx`: updates state, localStorage, and `PATCH /api/users/:userId` (non-blocking)
- Explanation length: "Brief"/"Detailed" toggle in Voice Active bar, stored in localStorage
- Length preference injected into both voice (`useGeminiLive`) and text (`useGeminiChat`) system instructions
- Bundle: 271KB

**Milestone:** Scan → auto-chat → narrate → stop → switch persona → toggle length → scan next. Smooth museum walkthrough flow.

---

### Phase 6: Image Generation + Gallery (P4) — COMPLETE
**Why last:** Depends on selfie (Phase 4), backend (Phase 1), and is the highest-risk new feature.

| # | Task | Files | Status |
|---|------|-------|--------|
| 6.1 | Types (`GeneratedImage`), i18n strings, selfie tracking in `UserContext` | `types.ts`, `utils/i18n.ts`, `components/OnboardingForm.tsx` | Done |
| 6.2 | Backend image generation endpoint (`POST /api/generate-image`) | `server/routes/generateImage.ts`, `server/config.ts`, `server/services/vertexai.ts`, `server/services/storage.ts` | Done |
| 6.3 | Gallery list endpoint (`GET /api/generate-image`) | `server/routes/generateImage.ts` | Done |
| 6.4 | Frontend API wiring (uses existing `apiPost`/`apiGet`) | — | Done |
| 6.5 | "Generate Me" button on AnalysisResultCard | `components/AnalysisResultCard.tsx` | Done |
| 6.6 | GenerateModal component (loading → result → save/download/share) | `components/GenerateModal.tsx` | Done |
| 6.7 | Wire GenerateModal into App.tsx | `App.tsx` | Done |
| 6.8 | Gallery component (grid view, detail overlay, download/share) | `components/Gallery.tsx` | Done |
| 6.9 | Gallery entry point in HUD (sparkle icon button) | `components/HUDOverlay.tsx`, `App.tsx` | Done |
| 6.10 | Build verification | — | Done |

**Changes:**
- **Model:** Gemini `gemini-2.0-flash-exp` via Vertex AI (configurable via `MODEL_IMAGE` env var)
- **Backend:** `POST /api/generate-image` — retrieves selfie from Cloud Storage, calls Gemini with image+prompt, saves result to Cloud Storage + Firestore, returns signed URL
- **Backend:** `GET /api/generate-image` — lists all generated images with signed URLs from Firestore
- **Backend:** Added `downloadBuffer()` to storage service, `getImageGenerateUrl()` to vertexai service
- **Frontend:** "Generate Me" button visible only when user has a selfie (tracked via `selfieUrl` in `UserContext`)
- **Frontend:** `GenerateModal` — full-screen overlay with animated loading (cycling progress messages), result preview, save/download/share actions
- **Frontend:** `Gallery` component — full-screen grid view of generated portraits, detail overlay with download/share, empty state
- **Frontend:** Gallery button (sparkle icon) in HUD top bar next to history button
- **Types:** Added `GeneratedImage` interface, `selfieUrl?: string` to `UserContext`
- **i18n:** 11 new translation keys for generate/gallery across en/pt/es
- Bundle: 288KB

**Milestone:** User taps "Generate Me" → sees themselves in the art style → image saved to gallery → downloadable/shareable.

---

## Dependency Graph

```
Phase 1 (Backend)
    │
    ├──▶ Phase 2 (Frontend migration)
    │        │
    │        ├──▶ Phase 4 (Onboarding + Persistence)
    │        │        │
    │        │        └──▶ Phase 6 (Image Gen + Gallery)
    │        │
    │        └──▶ Phase 5 (Interaction flow)
    │
    └──▶ Phase 3 (Theming) ← independent, can run in parallel with Phase 2
```

**Phases 2 + 3 can run in parallel** (theming is pure CSS/frontend, migration is service layer).

---

## Timeline (6 working days: Feb 27 — Mar 6)

| Day | Phase | Focus |
|-----|-------|-------|
| **Thu Feb 27** | Phase 1 | Proxy scaffold + Vertex AI forwarding (1.1–1.3) |
| **Fri Feb 28** | Phase 1 + 3 | Persistence endpoints (1.4–1.8) + Start theming (3.1–3.3) |
| **Mon Mar 2** | Phase 2 + 3 | Frontend migration (2.1–2.7) + Finish theming (3.4–3.8) |
| **Tue Mar 3** | Phase 4 | Onboarding + persistence wiring (4.1–4.8) |
| **Wed Mar 4** | Phase 5 | Interaction flow improvements (5.1–5.7) |
| **Thu Mar 5** | Phase 6 | Image generation + gallery (6.1–6.7) |
| **Fri Mar 6** | Buffer | Bug fixes, QA, deploy final build |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vertex AI Live API via proxy has latency/connection issues | P1 broken | Test early (Phase 1.3). Fallback: keep API key for live audio only |
| Image generation model (Imagen) has unexpected API differences | P4 delayed | Start Phase 6 research on day 1 in parallel. Fallback: skip image gen for March 6 |
| Google Sans font requires license/restricted access | P2 blocked | Fallback: use Inter or Product Sans (open alternatives) |
| Selfie capture fails on some mobile browsers | P0 partial | Test on iOS Safari + Android Chrome early. Fallback: file upload instead of camera |
| Cloud Run cold starts add latency to first request | UX issue | Set min-instances=1 for the event day |

---

## What's Out of Scope (March 6)

Per the meeting doc, these are deferred:

- Background soundtrack (Lyria 3) — exploratory
- Microphone selection UI
- Multi-museum support
- OAuth / Firebase Auth (UUID-based auth is sufficient for the event)

---

## Reference Docs

| Doc | Purpose |
|-----|---------|
| `docs/MEETING_REQUIREMENTS.md` | Meeting decisions, priorities, ownership |
| `docs/PERSISTENCE_ARCHITECTURE.md` | Firestore schema, Cloud Storage layout, API design |
| `docs/MIGRATION_VERTEX_AI.md` | Vertex AI migration details, WebSocket protocol, model names |
| `docs/APP_ARCHITECTURE.md` | Current codebase file-by-file map |
