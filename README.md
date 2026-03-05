# ArtLens AI

A mobile-first, camera-based art identification app built for the **Google Cloud AI Leadership Academy** at MNAC (Museu Nacional d'Art de Catalunya). Point your camera at any artwork to instantly identify it, explore its history, and chat with an AI art expert.

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

## Tech Stack

- **Frontend:** React 19, Tailwind CSS, TypeScript, Vite
- **Backend:** Express, WebSocket (`ws`), TypeScript, `tsx`
- **AI:** Vertex AI (Gemini 3 Flash, Gemini Live 2.5 Flash, Gemini 2.0 Flash image generation)
- **Storage:** Firestore (Native mode), Cloud Storage
- **Auth:** UUID-based via `X-User-Id` header + Firestore validation

## Project Structure

```
├── App.tsx                  # Frontend state machine (3 screens)
├── components/              # React components
├── services/
│   ├── geminiService.ts     # Artwork identification + deep analysis
│   └── apiClient.ts         # Fetch wrapper for backend API
├── hooks/
│   ├── useGeminiChat.ts     # Text chat via POST /api/generate
│   └── useGeminiLive.ts     # Voice chat via WebSocket /ws/live
├── utils/
│   ├── i18n.ts              # Translations (en, pt, es)
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
