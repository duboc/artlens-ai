# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install all dependencies (frontend + backend)
npm run dev          # Start both Vite (port 3000) and Express (port 3001) concurrently
npm run dev:client   # Start Vite dev server only (port 3000)
npm run dev:server   # Start Express backend only (port 3001, auto-restarts via tsx watch)
npm run build        # Production frontend build (outputs to dist/)
npm run start        # Production mode: Express serves dist/ + API (port 3001)
npm run preview      # Build then start in production mode
```

No test framework or linter is configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in values:
```
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET=artlens-ai-media
PORT=3001
```
The backend uses ADC (Application Default Credentials). Run `gcloud auth application-default login` for local development. No API keys are needed in the frontend — all AI calls are proxied through the Express backend.

## Architecture

ArtLens AI is a mobile-first, camera-based art identification app for the Google Cloud AI Leadership Academy at MNAC (Museu Nacional d'Art de Catalunya). All AI calls are proxied through Express to Vertex AI using ADC.

### Unified Project Structure

Single `package.json` with both frontend and backend dependencies. Vite (port 3000) proxies `/api/*` and `/ws/*` to Express (port 3001) in dev. Express serves `dist/` in production.

```
├── App.tsx               ← Frontend state machine (3 screens)
├── components/           ← 9 React components (camera, HUD, results, chat, history, onboarding)
├── services/
│   ├── geminiService.ts  ← identifyArtwork() + getDeepArtworkAnalysis() via /api/generate
│   └── apiClient.ts      ← Fetch wrapper with X-User-Id header
├── hooks/
│   ├── useGeminiChat.ts  ← Text chat: full history → POST /api/generate
│   └── useGeminiLive.ts  ← Voice chat: raw WebSocket → /ws/live
├── utils/
│   ├── i18n.ts           ← t(key, language) — ~80 keys for en|pt|es
│   └── audioUtils.ts     ← PCM encode/decode for live audio
├── types.ts              ← All shared types (ArtData, IdentifyResponse, Annotation, etc.)
├── server/
│   ├── index.ts          ← Express app + WS server + static serving
│   ├── config.ts         ← Env vars, model names, regions
│   ├── middleware/       ← auth.ts (X-User-Id → Firestore), errors.ts
│   ├── routes/           ← generate, users, images, scans, chats
│   ├── services/         ← vertexai (ADC tokens), firestore, storage
│   └── ws/live.ts        ← WebSocket bridge: browser ↔ Vertex AI Live API
├── index.html            ← Tailwind config, CSS custom properties, fonts, animations
└── vite.config.ts        ← Dev proxy for /api and /ws
```

### App Flow (State Machine in `App.tsx`)

Three sequential screens, all state in `App.tsx`, persisted to localStorage:
1. **Language Selection** → picks `en | pt | es`
2. **Onboarding** → name + persona (`guide | academic | blogger`), skip option
3. **Main Camera View** → scan, results, annotations, chat, history

### AI Pipeline

When the user scans artwork, `App.tsx` orchestrates:
1. **`identifyArtwork()`** — two parallel `POST /api/generate` calls:
   - Search-grounded (with `googleSearchRetrieval` tool) → title, artist, year, country, funFact
   - Vision (with `responseMimeType: 'application/json'`) → style, description, annotations with bounding boxes
2. **`getDeepArtworkAnalysis()`** — fires after step 1 (async, non-blocking) → historicalContext, technicalAnalysis, symbolism, curiosities[]

The search-grounded call cannot use JSON response mode due to tool constraint — relies on prompt engineering + `parseJSON()` helper that strips markdown fences and trailing commas.

### Conversation System

- **Text chat** (`useGeminiChat`) — sends full conversation history to `POST /api/generate`. localStorage persistence per artwork+language.
- **Live audio** (`useGeminiLive`) — raw WebSocket to `/ws/live`, proxied to Vertex AI Live API. Setup uses snake_case Vertex AI format; proxy injects full model resource path. Persona and deep analysis context injected into system instruction. PCM audio: 16kHz input, 24kHz output.

### Backend (Express + WebSocket)

Cloud Run proxy for Vertex AI, Firestore, and Cloud Storage. Lives in `server/`, shares root `package.json`.

- **Auth:** UUID-based via `X-User-Id` header. `POST /api/users` is unauthenticated. All other `/api/*` routes require auth validated against Firestore.
- **`POST /api/generate`**: Normalizes input (wraps single contents in array, defaults role to "user"), forwards to Vertex AI, adds top-level `text` field to response.
- **`/ws/live`**: Pass-through WebSocket bridge. Injects full model resource path into setup message. ADC token on first message. 15-min session timeout.
- **Firestore:** `users/{userId}`, `users/{userId}/scans/{scanId}`, `users/{userId}/scans/{scanId}/chats/{messageId}`
- **Cloud Storage:** `users/{userId}/selfie.jpg`, `users/{userId}/scans/{scanId}.jpg`
- **Config defaults:** port 3001, `gemini-3-flash-preview` (text, region: global), `gemini-live-2.5-flash-native-audio` (live, region: us-central1)

### UI Layering (z-index stack)

CameraFeed → ImageAnnotationLayer → HUDOverlay → AnalysisResultCard/AnnotationCard → ChatWindow → HistoryDrawer

### Theming: Black + Google Blue

- **Fonts:** Google Sans (titles), Google Sans Text (body), JetBrains Mono (labels) — Google Fonts in `index.html`
- **Palette:** `#000000` background, `#1a1a1a` surfaces, `#4285F4` Google Blue accent — CSS custom properties in `:root`
- **Tailwind:** Extended in `index.html` `<script>` block with custom colors, animations (`reveal`, `scan-line`, `glow-pulse`, `shimmer`), utility classes (`.warm-glass`, `.text-shimmer`, `.noise-bg`, `.h-dvh`, `.pt-safe`/`.pb-safe`)
- **Personas (display names):** Classic Guide (`guide`), Historian (`academic`), Influencer (`blogger`) — internal values unchanged

### Key Conventions

- Tailwind CSS via CDN, configured in `index.html`
- Path alias: `@/` → project root (tsconfig.json + vite.config.ts)
- All types in `types.ts` — `IdentifyResponse` extends `ArtData` with sources, deepAnalysis, annotations
- Localization: all UI strings via `t(key, language)` from `utils/i18n.ts`
- Mobile: 100dvh fallback, safe area insets, 16px min font (iOS), haptic feedback, reduced-motion support

## Development Workflow

### Planning Protocol

Before writing any code, you MUST:

1. Read `PLAN.md` in the project root. If it exists, follow it strictly — execute only the next unchecked task. Do not skip ahead.
2. If no `PLAN.md` exists and the task is non-trivial, generate one before coding. Format it as a **Markdown checklist** where each item is a complete, executable instruction.
3. After generating a plan, critique it: identify gaps, missing edge cases, and architectural risks. Regenerate an improved version before proceeding.
4. Save the final plan as `PLAN.md` in the project root.

**Execute one checklist item at a time.** After completing each item, mark it `[x]` in `PLAN.md`.

### Code Generation Rules

- **Explain your approach step-by-step before writing any code.**
- **Reference files by path and line number** (`components/ChatWindow.tsx:42-88`), not by pasting entire files.
- **Use the codebase's exact identifiers** — function names, class names, variable names as they appear.
- **One task at a time.** Complete one change, verify it works, then move to the next.
- **Do not introduce new libraries or dependencies** unless specified in `PLAN.md` or explicitly approved.
- **Do not modify architecture or design patterns** unless explicitly instructed.

### Version Control

- Commit with a prefixed message: `feat:`, `fix:`, `refactor:`, `docs:`, `ui:`, `test:`.
- Keep commits small and atomic — one logical change per commit.

### Hard Rules

- DO NOT commit secrets, API keys, or credentials.
- DO NOT write code for a task that is not in `PLAN.md` when a plan exists.
- DO NOT attempt to redesign system architecture. Implement the user's design.

## Upcoming Work (Roadmap)

6-phase roadmap targeting March 6, 2026 code complete (event: March 18, 2026 at MNAC):

1. ~~**Backend Foundation**~~ — **DONE.** Express + WebSocket proxy, all routes/services/middleware.
2. ~~**Frontend → Backend Migration**~~ — **DONE.** `@google/genai` SDK removed from frontend (bundle: 530KB → 261KB). No API key in browser.
3. ~~**Theming + Persona Rename**~~ — **DONE.** Black + Google Blue palette, Google Sans font, Classic Guide / Historian / Influencer.
4. ~~**Onboarding + Persistence**~~ — **DONE.** 3-step wizard (name+email → selfie → persona). Users + scans persisted to Firestore.
5. ~~**Core Interaction Flow**~~ — **DONE.** Auto-chat after scan, auto-voice, stop narration, persona switch, explanation length toggle (271KB).
6. ~~**Image Generation + Gallery**~~ — **DONE.** "Generate Me" via Gemini image generation, virtual gallery with download/share (288KB).

See `docs/IMPLEMENTATION_ROADMAP.md` for full details, timeline, and dependency graph.

## Reference Docs

| Doc | Purpose |
|-----|---------|
| `docs/IMPLEMENTATION_ROADMAP.md` | 6-phase execution plan with timeline and dependency graph |
| `docs/PHASE1_BACKEND_SPEC.md` | Backend endpoints, schemas, testing plan with curl examples |
| `docs/PERSISTENCE_ARCHITECTURE.md` | Firestore schema, Cloud Storage layout, API design |
| `docs/MIGRATION_VERTEX_AI.md` | Migration guide from Gemini API key to Vertex AI with ADC |
| `docs/APP_ARCHITECTURE.md` | File-by-file map with AI prompts and improvement opportunities |
| `docs/MEETING_REQUIREMENTS.md` | Meeting decisions, priorities (P0–P4), ownership |

## Model Preferences

- **Voice/Live API:** `gemini-live-2.5-flash-native-audio` (region: us-central1)
- **Text interactions:** `gemini-3-flash-preview` (region: global)
- **Image interactions:** `gemini-3.1-flash-image-preview` (region: global)
