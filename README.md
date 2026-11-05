# ArtLens AI

A mobile-first, camera-based art identification app built for the **Google Cloud AI Leadership Academy**, currently set up for the **Museo Reina Sofía** in Madrid (and reusable in any museum via [museum profiles](#museum-profiles)). Point your camera at any artwork to instantly identify it, explore its history, chat with an AI art expert, complete missions and climb the ranking.

## Features

- **Artwork Identification** — Scan any artwork with your camera to get title, artist, year, style, and fun facts (powered by Gemini with Google Search grounding)
- **Interactive Annotations** — Tap highlighted regions on the artwork to learn about specific details, symbols, and techniques
- **AI Chat** — Text or voice conversation with a personalized AI art expert (choose Classic Guide, Historian, or Influencer persona)
- **"Generate Me"** — See yourself reimagined in the style of the artwork you're viewing
- **Virtual Gallery** — Browse, download, and share your AI-generated portraits
- **Multilingual** — English, Portuguese, and Spanish

## Architecture

```
Browser (React + Vite)  ──▶  Express API (port 3001)  ──▶  Vertex AI (Gemini)
                              ├── Firestore (users, scans, chats)
                              └── Cloud Storage (images)
```

All AI calls are proxied through the Express backend using Application Default Credentials (ADC). No API keys in the browser.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`)
- A GCP project with billing enabled

### Setup

1. **Clone and install:**
   ```bash
   git clone <repo-url> && cd artlens-ai
   npm install
   ```

2. **Configure GCP resources** (Vertex AI, Firestore, Cloud Storage):
   ```bash
   ./setup.sh
   ```
   This enables APIs, creates resources, sets up ADC, and writes `.env.local`. Run `./setup.sh --help` for options.

   Or configure manually — copy `.env.example` to `.env.local` and fill in values:
   ```bash
   cp .env.example .env.local
   gcloud auth application-default login
   ```

3. **Run:**
   ```bash
   npm run dev
   ```
   Opens at [http://localhost:3000](http://localhost:3000). The Express backend runs on port 3001; Vite proxies `/api/*` and `/ws/*` automatically.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite (3000) + Express (3001) concurrently |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express backend only (auto-restarts on changes) |
| `npm run build` | Production frontend build (outputs to `dist/`) |
| `npm run start` | Production mode: Express serves `dist/` + API |
| `npm run preview` | Build then start in production mode |

## Environment Variables

See [`.env.example`](.env.example) for all available variables. The two required ones:

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Your GCP project ID |
| `GCS_BUCKET` | Cloud Storage bucket name |

## Museum Profiles

The experience is tailored per venue by a **museum profile** in [`museums/`](museums/): official name, guide context (building, collection highlights), guidance for the guide, an identification hint, museum-specific chat topic chips (localized), and the welcome-screen event label. The generic profile works anywhere without assuming a venue.

| Profile | `MUSEUM_ID` | Event label |
|---------|-------------|-------------|
| Museo Nacional Centro de Arte Reina Sofía (Madrid) | `reina-sofia` | Madrid 2026 |
| Museu Nacional d'Art de Catalunya (Barcelona) | `mnac` | Barcelona 2026 |
| Any museum | `generic` (default) | — |

Select the profile per deployment with `MUSEUM_ID` in `.env`; the frontend reads it from `GET /api/config` at startup. For testing, `?museum=<id>` in the URL overrides it. To add a venue, copy `museums/reinaSofia.ts`, adjust the content, and register it in `museums/index.ts`.

## Game Layer: Missions, Quiz, Ranking

Individual challenges on top of the scan flow, scored **server-side** so the ranking can't be edited from the browser. Navigation is a bottom tab bar: **Scan · Missions · Ranking · Profile**.

| Feature | How it works |
|---------|--------------|
| **Missions** | Each museum profile defines missions (`missions` in `museums/*.ts`, e.g. 8 for the Reina Sofía). After a scan is saved, Gemini judges which open missions the identified artwork satisfies (JSON schema, temperature 0). |
| **Quiz** | 3 multiple-choice questions per scan, generated from the scan and its deep analysis in the visitor's language. Answers are checked on the server; options are shuffled server-side. |
| **Ranking** | Per-museum individual ranking (top 50 + your position), first name + last initial only. Auto-refreshes every 30 s. |
| **How the AI thought** | Expandable panel on every result: model (and whether the backup model answered), response time, reasoning level, the model's own confidence and evidence, Google searches it ran, sources, and the museum context it was given. |

Scoring (`museums/scoring.ts`): new artwork +10 · mission +100–150 · correct quiz answer +20 · perfect quiz +20 bonus. Re-scanning the same artwork earns nothing.

API (all require `X-User-Id`; `?museum=` follows the visitor's profile):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/game/scans/:scanId/award` | Score a saved scan (idempotent) → `{ points, newArtwork, missions, totalPoints }` |
| `GET /api/game/missions` | Mission status + total points |
| `GET /api/game/leaderboard` | Ranking + your position |
| `POST /api/game/quiz/:scanId` | Get or create the scan's quiz (no answers included) |
| `POST /api/game/quiz/:scanId/answer` | `{ questionIndex, choice }` → correct answer, explanation, points |

Firestore: `leaderboards/{museumId}/players/{userId}` (+ `artworks/` subcollection for de-duplication); quiz and awards live on `users/{userId}/scans/{scanId}`.

## Result Sheet, Narration and Install

The moment after a scan is built to feel like a native app (`components/result/`, `components/sheet/`).

| Feature | How it works |
|---------|--------------|
| **Gesture sheet** | The result opens as a sheet that follows the finger. It stops at medium (50%) and full, with momentum projection, a velocity-based critically damped spring, rubber-banding at the top, and pull down to close. Constants come from Apple WWDC18 "Designing Fluid Interfaces" and Android `BottomSheetBehavior` (`sheetPhysics.ts`). While dragging only `transform` changes. |
| **Photo** | The full-screen frozen frame morphs (View Transitions API) into a photo that fits above the medium sheet, Google Lens style. At full, each scan's own photo grows into the sheet. |
| **System back** | Android back, the iOS edge swipe and Escape close chat/quiz first, then the sheet (History API). |
| **Earlier scans** | Swipe sideways inside the sheet; each scan keeps its own narration audio and text. |
| **Narration text** | When the scan ends, the guide's words appear and the sentence being spoken is highlighted. Sync uses only the Gemini Live stream: transcription text, plus pauses detected in the received PCM and the speaking rate (`utils/narrationTimeline.ts`). There is no speech-to-text service. Across 43 recorded sessions (8 captured in the app), 168/169 sentences switch within 300 ms of the voice (`tests/narration-timeline.test.ts` replays every session in real time). Five new in-app sessions, recorded after the last change, scored 21/21. |
| **Controls** | Pause / resume (the AudioContext is suspended), listen again from the buffered audio (no new Live session), "Read only" mode (remembered). Replays use an `<audio>` element, so the lock screen shows Media Session controls. During the first live stream (Web Audio) it may not, so locking the screen pauses the stream to resume later. |
| **Saved with the scan** | `POST /api/scans/:scanId/narration` (multipart: `audio` WAV ≤4 MB + `meta` JSON) stores `users/{uid}/narrations/{scanId}.wav` in Cloud Storage and `{ audioPath, script, sentences, durationSec }` on the scan. `GET /api/images/...` supports HTTP range requests (Safari audio). |
| **Install** | `public/manifest.webmanifest` (standalone, theme color, maskable icons), `viewport-fit=cover` + safe areas, no tap highlight / overscroll bounce / accidental selection. The browser bar only disappears once the app is added to the home screen: Profile shows "Add to home screen" (native prompt on Android, steps on iOS). |

Debug hook for tests: with `?debug` in the URL, `window.__artlensNarration` exposes caption switch times, the AudioContext state and the audio element state.

## Deploying & Access

`./deploy.sh` deploys to Cloud Run from source. By default the service is **public** — visitors at the event open the URL and onboard with name + email; no Google sign-in is required. The `X-User-Id` header identifies the app-level user.

| Mode | Command | Access |
|------|---------|--------|
| Public (default) | `./deploy.sh` | `--allow-unauthenticated --no-iap` |
| Restricted | `./deploy.sh --iap` | Behind [Identity-Aware Proxy](https://cloud.google.com/iap); grants `roles/run.invoker` to the IAP service agent |

Every deploy also sets `--timeout 3600` (Cloud Run's request timeout caps WebSocket lifetime, and Live voice sessions can last up to 15 min), `--min-instances 1`, `--session-affinity`, and passes `.env` through an env-vars file so comma-separated values like `ALLOWED_ORIGINS` are preserved.

### Optional: IAP

To restrict access (e.g. for internal testing before the event):

```bash
./deploy.sh --iap
./setup-iap.sh                           # Once per project: OAuth brand + client
./configure-iap.sh                       # Grant google.com domain (default)
./configure-iap.sh --user alice@google.com
./configure-iap.sh --status
```

Required IAM on the operator for IAP: `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/iap.admin`, `roles/serviceusage.serviceUsageAdmin`.

Run `./deploy.sh` (without `--iap`) to make the service public again.

When running the API test scripts against an IAP-protected URL, sign in with an account that has `roles/iap.httpsResourceAccessor` — the scripts attach an IAP identity token automatically:

```bash
gcloud auth login
BASE_URL=https://artlens-ai-xxxxx.run.app ./scripts/test-all.sh
```

## Tech Stack

- **Frontend:** React 19, Tailwind CSS, TypeScript, Vite
- **Backend:** Express, WebSocket (`ws`), TypeScript, `tsx`
- **AI:** Vertex AI — `gemini-3.5-flash-lite` (text, fallback `gemini-3.8-flash`), `gemini-3.8-live` (voice + narration), `gemini-3.1-flash-image` (portraits). All model names are configured server-side; see `.env.example`.
- **Storage:** Firestore (Native mode), Cloud Storage
- **Auth:** UUID-based via `X-User-Id` header + Firestore validation (game points are computed only on the server)

## Project Structure

```
├── App.tsx                  # Frontend state machine (3 screens)
├── components/              # React components
├── services/
│   ├── geminiService.ts     # Artwork identification + deep analysis
│   └── apiClient.ts         # Fetch wrapper for backend API
├── hooks/
│   ├── useGeminiChat.ts     # Text chat via POST /api/generate
│   ├── useGeminiLive.ts     # Voice chat via WebSocket /ws/live
│   ├── useNarration.ts      # Intro narration: Live stream, captions, pause/replay, Media Session
│   └── NarrationProvider.tsx # Keeps narration state out of the app tree (no re-render while dragging)
├── utils/
│   ├── i18n.ts              # Translations (en, pt, es)
│   ├── narrationTimeline.ts # Sentence timing from Live audio pauses + transcript
│   └── audioUtils.ts        # PCM encode/decode for live audio
├── types.ts                 # Shared TypeScript types
├── server/
│   ├── index.ts             # Express app + WebSocket server
│   ├── config.ts            # Environment config
│   ├── middleware/           # Auth, error handling
│   ├── routes/              # API endpoints
│   ├── services/            # Vertex AI, Firestore, Cloud Storage
│   └── ws/live.ts           # WebSocket bridge to Vertex AI Live API
├── setup.sh                 # GCP project bootstrap script
└── vite.config.ts           # Dev proxy config
```

## License

Private — Google Cloud AI Leadership Academy.
