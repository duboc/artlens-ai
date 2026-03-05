# Phase 1: Backend Foundation — Technical Specification

**Scope:** Scaffold and deploy a Cloud Run proxy server that handles Vertex AI forwarding, Firestore persistence, and Cloud Storage image management.

**Milestone:** Proxy running on Cloud Run, forwarding Vertex AI calls, all CRUD endpoints working via `curl`.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Dependencies](#2-dependencies)
3. [Configuration & Environment](#3-configuration--environment)
4. [Server Scaffold](#4-server-scaffold-task-11)
5. [Vertex AI Text Proxy](#5-vertex-ai-text-proxy-task-12)
6. [Vertex AI Live API WebSocket Bridge](#6-vertex-ai-live-api-websocket-bridge-task-13)
7. [Firestore Client & User Endpoints](#7-firestore-client--user-endpoints-task-14)
8. [Cloud Storage & Image Upload](#8-cloud-storage--image-upload-task-15)
9. [Scan Endpoints](#9-scan-endpoints-task-16)
10. [Chat Endpoints](#10-chat-endpoints-task-17)
11. [Deployment](#11-deployment-task-18)
12. [Testing Plan](#12-testing-plan)
13. [GCP Prerequisites](#13-gcp-prerequisites)

---

## 1. Project Structure

The backend lives in `server/` but shares the root `package.json` with the frontend. No separate server package, tsconfig, or Dockerfile. In development, Vite (port 3000) proxies `/api/*` and `/ws/*` to Express (port 3001). In production, Express serves the built frontend from `dist/` and handles all routes.

```
├── package.json              ← Single package.json (frontend + backend deps)
├── vite.config.ts            ← Vite dev proxy: /api → :3001, /ws → ws://:3001
├── .env.example              ← Backend env vars template
├── server/
│   ├── index.ts              ← Entry point: Express app + WS server + static serving
│   ├── config.ts             ← Environment variables, constants
│   ├── middleware/
│   │   ├── auth.ts           ← X-User-Id validation middleware
│   │   └── errors.ts         ← Global error handler
│   ├── routes/
│   │   ├── generate.ts       ← POST /api/generate (Vertex AI text)
│   │   ├── users.ts          ← POST/GET/PATCH /api/users, GET /api/users/:id/scans
│   │   ├── images.ts         ← POST /api/images/upload, GET /api/images/*
│   │   ├── scans.ts          ← POST /api/scans, PATCH /api/scans/:id/deep-analysis
│   │   └── chats.ts          ← POST/GET /api/scans/:id/chats
│   ├── services/
│   │   ├── vertexai.ts       ← ADC token management, Vertex AI URL builders
│   │   ├── firestore.ts      ← Firestore client initialization (singleton)
│   │   └── storage.ts        ← Cloud Storage upload + signed URL generation
│   └── ws/
│       └── live.ts           ← WebSocket bridge for Vertex AI Live API
```

**Rationale:** Unified project avoids separate dependency management. Vite proxy in dev and Express static serving in prod keep the architecture simple. Each route file maps 1:1 to a resource. Services encapsulate GCP client setup.

---

## 2. Dependencies

Backend dependencies are merged into the root `package.json` alongside frontend deps. Key scripts:

```json
{
  "scripts": {
    "dev": "npm run dev:server & npm run dev:client",
    "dev:client": "vite --port=3000 --host=0.0.0.0",
    "dev:server": "tsx watch server/index.ts",
    "build": "vite build",
    "start": "node --import tsx server/index.ts",
    "preview": "npm run build && npm run start"
  }
}
```

| Package | Purpose |
|---------|---------|
| `express` | HTTP server and REST routing |
| `ws` | WebSocket server for Live API bridge |
| `google-auth-library` | ADC token acquisition for Vertex AI |
| `@google-cloud/firestore` | Firestore Native mode client |
| `@google-cloud/storage` | Cloud Storage client for image upload/download |
| `multer` | Multipart form-data parsing for image uploads |
| `uuid` | User ID generation at onboarding |
| `cors` | Cross-origin requests from the frontend |
| `dotenv` | Environment variable loading from `.env` files |
| `tsx` | TypeScript execution for local development (no build step needed) |

---

## 3. Configuration & Environment

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port (3001 for local dev, Cloud Run overrides) |
| `GOOGLE_CLOUD_PROJECT` | Yes | — | Google Cloud project ID (also accepts `GCP_PROJECT_ID`) |
| `GCS_BUCKET` | Yes | — | Cloud Storage bucket name (e.g. `artlens-ai-media`) |
| `FIRESTORE_DATABASE` | No | `(default)` | Firestore database ID |
| `VERTEX_REGION_TEXT` | No | `global` | Region for text generation models |
| `VERTEX_REGION_LIVE` | No | `us-central1` | Region for Live API models |
| `MODEL_TEXT` | No | `gemini-3-flash-preview` | Text generation model name |
| `MODEL_LIVE` | No | `gemini-live-2.5-flash-native-audio` | Live API model name |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |

### `config.ts` Structure

```
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || '',
  bucket: process.env.GCS_BUCKET || '',
  firestoreDb: process.env.FIRESTORE_DATABASE || '(default)',
  vertex: {
    regionText: process.env.VERTEX_REGION_TEXT || 'global',
    regionLive: process.env.VERTEX_REGION_LIVE || 'us-central1',
    modelText: process.env.MODEL_TEXT || 'gemini-3-flash-preview',
    modelLive: process.env.MODEL_LIVE || 'gemini-live-2.5-flash-native-audio',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
};
```

**Note on model names:** Defaults set to `gemini-3-flash-preview` (text) and `gemini-live-2.5-flash-native-audio` (live) per `MIGRATION_VERTEX_AI.md`. These are overridable via environment variables without code changes.

---

## 4. Server Scaffold (Task 1.1)

### Entry Point (`server/index.ts`)

The entry point loads env vars via `dotenv/config`, creates an Express app, attaches a WebSocket server, and in production serves the built frontend from `dist/`.

**Responsibilities:**
- Load environment variables via `dotenv/config`
- Create Express app with JSON body parsing (limit: `50mb` for base64 images)
- Apply CORS middleware using `ALLOWED_ORIGINS`
- Mount route modules at their prefixes
- Apply global error handler
- Serve `dist/` as static files with SPA fallback (production)
- Create `http.Server`, then attach `ws.WebSocketServer` on path `/ws/live`
- Add `/health` endpoint returning `{ status: "ok" }`
- Listen on `PORT` (default 3001)

**Route mounting:**
- `POST /api/users` — no auth required (creates user)
- `GET/PATCH /api/users/:userId` — auth handled inside router
- `GET /api/users/:userId/scans` — auth handled inside router
- `/api/generate`, `/api/images`, `/api/scans` — auth middleware applied at mount
- `/api/scans/:scanId/chats` — mounted under `/api/scans` path

### CORS Middleware

- Allow origins from `ALLOWED_ORIGINS` config
- Allow headers: `Content-Type`, `X-User-Id`
- Allow methods: `GET`, `POST`, `PATCH`, `OPTIONS`
- Credentials: `true`

### Auth Middleware (`middleware/auth.ts`)

Applied to all `/api/*` routes except `POST /api/users` (which creates the user).

**Logic:**
1. Extract `X-User-Id` header
2. If missing → `401 { error: "Missing X-User-Id header" }`
3. Look up user document in Firestore `users/{userId}`
4. If not found → `401 { error: "Unknown user" }`
5. If found → attach `req.userId` and continue

**Performance note:** For the event scope (~200 users), a per-request Firestore read is acceptable. If performance becomes a concern, add an in-memory LRU cache of validated user IDs with a 5-minute TTL.

### Error Handler (`middleware/errors.ts`)

Global Express error handler:
- Log the full error to `console.error` (Cloud Run captures stdout/stderr)
- Return `500 { error: "Internal server error" }` (never leak stack traces)
- For known error types (e.g. Firestore NOT_FOUND), return appropriate status codes

---

## 5. Vertex AI Text Proxy (Task 1.2)

### Endpoint: `POST /api/generate`

**Purpose:** Forward text generation requests to Vertex AI, authenticating with ADC. This replaces the client-side `ai.models.generateContent()` call.

### Request

```
POST /api/generate
Content-Type: application/json
X-User-Id: {userId}

{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } },
        { "text": "Identify this artwork..." }
      ]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json"
  },
  "tools": [
    { "googleSearchRetrieval": {} }
  ]
}
```

**Note on request body:** The body is passed through to Vertex AI with minimal transformation. The frontend (Phase 2) will construct payloads using Vertex AI field names:
- `config.tools` → `tools` (top-level)
- `config.responseMimeType` → `generationConfig.responseMimeType`
- `googleSearch: {}` → `googleSearchRetrieval: {}` (Vertex AI syntax)

**Input normalization (proxy responsibility):**
The proxy must normalize `contents` before forwarding, since the frontend SDK currently sends a single content object (`{ parts: [...] }`) rather than the array Vertex AI expects (`[{ role: "user", parts: [...] }]`):
- If `contents` is an object (not an array) → wrap in array: `[contents]`
- If a content item has no `role` → default to `"user"`

**Multi-turn chat support:**
Text chat (Phase 2) will use this same endpoint with full conversation history in `contents`:
```json
{
  "contents": [
    { "role": "user", "parts": [{ "text": "What style is this?" }] },
    { "role": "model", "parts": [{ "text": "This is Post-Impressionism..." }] },
    { "role": "user", "parts": [{ "text": "Tell me more about the technique" }] }
  ],
  "systemInstruction": { "parts": [{ "text": "You are an expert art historian..." }] }
}
```
No server-side chat state is needed — the frontend maintains conversation history and sends the full context each time.

### Response

The Vertex AI response is passed through to the frontend. The proxy adds a convenience `text` field at the top level so the frontend can access it the same way it currently uses the SDK's `response.text`:

```json
{
  "text": "...",
  "candidates": [
    {
      "content": {
        "parts": [{ "text": "..." }],
        "role": "model"
      },
      "groundingMetadata": {
        "groundingChunks": [
          { "web": { "title": "...", "uri": "..." } }
        ]
      }
    }
  ]
}
```

**Response normalization (proxy responsibility):**
- Extract `candidates[0].content.parts[0].text` and add as top-level `text` field
- This minimizes Phase 2 frontend changes (current code reads `response.text`)
- Grounding metadata is already at `candidates[0].groundingMetadata` in both SDK and REST formats — no change needed

### Proxy Logic

```
1. Parse request body
2. Determine model from body or use config default
3. Build Vertex AI URL:
   - For text: https://{VERTEX_REGION_TEXT}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{VERTEX_REGION_TEXT}/publishers/google/models/{MODEL}:generateContent
4. Get ADC access token (cached, auto-refreshed)
5. Forward request to Vertex AI with:
   - Authorization: Bearer {token}
   - Content-Type: application/json
6. Stream or return the response to the client
7. On Vertex AI error → map to appropriate HTTP status and return error message
```

### ADC Token Management (`services/vertexai.ts`)

```
- Use GoogleAuth with scope: https://www.googleapis.com/auth/cloud-platform
- Cache the auth client instance (singleton)
- On each request: call client.getAccessToken()
  - The google-auth-library handles token caching and refresh internally
  - Tokens are valid for ~1 hour, library auto-refreshes ~5 min before expiry
```

### Vertex AI URL Construction

Two different endpoint patterns based on the region:

| Region | Endpoint Pattern |
|--------|-----------------|
| `global` | `https://global-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/publishers/google/models/{MODEL}:generateContent` |
| `us-central1` | `https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/{MODEL}:generateContent` |

### Request Mapping: Current SDK → Proxy

The frontend currently calls the SDK like this:

```typescript
// Call 1: Search-grounded identification
ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: { parts: [imagePart, { text: prompt }] },
  config: { tools: [{ googleSearch: {} }] }
});

// Call 2: Visual analysis with JSON mode
ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: { parts: [imagePart, { text: prompt }] },
  config: { responseMimeType: 'application/json' }
});

// Call 3: Deep analysis
ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: { parts: [imagePart, { text: prompt }] },
  config: { responseMimeType: 'application/json' }
});
```

The proxy endpoint receives these as REST payloads and forwards them. The frontend migration (Phase 2) will replace SDK calls with `fetch()` to `/api/generate`.

### Error Handling

| Vertex AI Status | Proxy Response | Notes |
|-----------------|----------------|-------|
| 200 | 200 + passthrough body | Success |
| 400 | 400 + error message | Bad request (invalid model, malformed content) |
| 403 | 403 + error message | Permission denied (ADC misconfigured) |
| 429 | 429 + error message | Rate limited — include `Retry-After` if present |
| 500/503 | 502 + error message | Upstream failure |

---

## 6. Vertex AI Live API WebSocket Bridge (Task 1.3)

### Endpoint: `ws://host/ws/live`

**Purpose:** Bridge a browser WebSocket connection to the Vertex AI Live API WebSocket, handling ADC authentication transparently.

### Connection Flow

```
Browser                    Proxy                         Vertex AI
  │                          │                               │
  ├──── WS connect ─────────▶│                               │
  │                          │                               │
  │     (Step 1: Setup)      │                               │
  ├──── { setup: {...} } ───▶│                               │
  │                          ├─── Get ADC token ────────────▶│
  │                          │                               │
  │                          ├─── WSS connect ──────────────▶│
  │                          │    (with Bearer token)        │
  │                          │                               │
  │                          ├─── { setup: {...} } ─────────▶│
  │                          │                               │
  │                          │◀── { setupComplete } ─────────┤
  │◀── { setupComplete } ────┤                               │
  │                          │                               │
  │     (Step 2: Streaming)  │                               │
  ├──── { realtime_input } ─▶│── forward ──────────────────▶│
  │                          │                               │
  │                          │◀── { serverContent } ─────────┤
  │◀── { serverContent } ────┤                               │
  │                          │                               │
  │     (Bidirectional)      │    (Pure message forwarding)  │
  │          ...             │          ...                  │
  │                          │                               │
  ├──── WS close ───────────▶│── close upstream WS ─────────▶│
  │                          │                               │
```

### Detailed Bridge Logic

**On browser WebSocket connection:**
1. Wait for first message from browser (the `setup` message)
2. Extract `setup.model` to determine the Vertex AI model URI
3. Get ADC access token
4. Build the Vertex AI WebSocket URL:
   ```
   wss://{VERTEX_REGION_LIVE}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent
   ```
5. Open upstream WSS connection to Vertex AI with headers:
   ```
   Authorization: Bearer {token}
   Content-Type: application/json
   ```
6. On upstream open → forward the `setup` message to Vertex AI
7. Begin bidirectional message forwarding

**Message forwarding rules:**
- Browser → Vertex AI: forward JSON as-is (setup, realtime_input, client_content)
- Vertex AI → Browser: forward JSON as-is (setupComplete, serverContent)
- The proxy does NOT transform message formats — it is a pure pass-through bridge
- The frontend (Phase 2) is responsible for sending messages in Vertex AI format (snake_case fields, `system_instruction` as `{ parts: [{ text }] }`, etc.)

**Format note:** The current frontend SDK uses camelCase (`responseModalities`, `systemInstruction` as string). The Vertex AI WebSocket uses snake_case (`response_modalities`, `system_instruction` as `{ parts: [{ text }] }`). This conversion happens in the frontend during Phase 2 migration, not in the proxy.

**Connection lifecycle management:**
- If browser disconnects → close upstream Vertex AI WebSocket
- If Vertex AI disconnects → close browser WebSocket with code `1001` and reason
- If ADC token acquisition fails → close browser WebSocket with code `1008` (policy violation) and error message
- Set a connection timeout of 15 minutes (Vertex AI Live API has a ~15-min session limit)

### Vertex AI Live API WebSocket URL

```
wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent
```

**Query parameters:** The access token can alternatively be passed as a query param:
```
wss://...?access_token={TOKEN}
```

This avoids the need for custom headers on WebSocket connections (which some clients don't support).

### Message Types (Reference)

**Browser → Proxy → Vertex AI:**

| Message | Structure | Purpose |
|---------|-----------|---------|
| Setup | `{ setup: { model, generation_config, system_instruction, ... } }` | Initialize session |
| Audio input | `{ realtime_input: { media_chunks: [{ mime_type, data }] } }` | Stream microphone audio |
| Text input | `{ client_content: { turns: [{ parts: [{ text }] }] } }` | Send text message |

**Vertex AI → Proxy → Browser:**

| Message | Structure | Purpose |
|---------|-----------|---------|
| Setup complete | `{ setupComplete: {} }` | Session ready |
| Model audio | `{ serverContent: { modelTurn: { parts: [{ inlineData: { data, mimeType } }] } } }` | Audio response chunks |
| Output transcript | `{ serverContent: { outputTranscription: { text } } }` | Model speech transcription |
| Input transcript | `{ serverContent: { inputTranscription: { text } } }` | User speech transcription |
| Turn complete | `{ serverContent: { turnComplete: true } }` | End of model turn |
| Interrupted | `{ serverContent: { interrupted: true } }` | User interrupted model |

### Token Refresh During Long Sessions

The Live API supports sessions up to ~15 minutes. ADC tokens are valid for ~1 hour, so a single token covers the full session lifetime. No mid-session token refresh is needed.

### Error Scenarios

| Scenario | Handling |
|----------|----------|
| ADC token acquisition fails | Close browser WS with code `1008`, message: "Authentication failed" |
| Upstream WS connection fails | Close browser WS with code `1011`, message: "Upstream connection failed" |
| Upstream WS closes unexpectedly | Close browser WS with same code/reason |
| Browser sends invalid JSON | Log warning, ignore message (don't close) |
| Upstream sends invalid JSON | Log warning, ignore message |

---

## 7. Firestore Client & User Endpoints (Task 1.4)

### Firestore Client (`services/firestore.ts`)

**Initialization:**
```
- Create Firestore instance with projectId from config
- ADC handles auth automatically (no credentials in code)
- Export singleton instance for use across routes
- Export helper: getDoc, setDoc, updateDoc, queryCollection
```

### Collection Schema (from `PERSISTENCE_ARCHITECTURE.md`)

```
users/{userId}
├── email: string
├── name: string
├── persona: "guide" | "academic" | "blogger"
├── language: "en" | "pt" | "es"
├── selfieUrl: string (Cloud Storage path)
├── createdAt: Timestamp
└── lastActiveAt: Timestamp
```

**Onboarding flow (3 steps):**
1. **Email + Name** — User enters their name and email address
2. **Selfie** — User takes a selfie with the front camera (used for image generation in Phase 6)
3. **Persona** — User selects their guide persona (Classic Guide / Historian / Influencer)

Language is selected on a separate screen before onboarding begins and is passed from `App.tsx` state.

### Endpoints

#### `POST /api/users` — Create user at onboarding

**Auth:** No `X-User-Id` required (this creates the user).

**Request:**
```json
{
  "name": "Anderson",
  "email": "anderson@example.com",
  "persona": "guide",
  "language": "en"
}
```

**Field requirements:**

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `name` | Yes | — | User display name |
| `email` | Yes | — | User email address |
| `persona` | Yes | — | Must be `guide`, `academic`, or `blogger` |
| `language` | Yes | — | Must be `en`, `pt`, or `es`. Passed from App.tsx state. |

**Logic:**
1. Validate required fields: `name`, `email`, `persona`, `language`
2. Validate `email` is a non-empty string (basic format check)
3. Validate `persona` is one of: `guide`, `academic`, `blogger`
4. Validate `language` is one of: `en`, `pt`, `es`
5. Generate UUID via `uuid.v4()`
6. Create Firestore document at `users/{uuid}`:
   ```
   {
     name, email, persona, language,
     selfieUrl: "",
     createdAt: FieldValue.serverTimestamp(),
     lastActiveAt: FieldValue.serverTimestamp()
   }
   ```
7. Return `201 { userId: "{uuid}" }`

**Note:** The selfie is uploaded in a separate call after user creation:
```
POST /api/images/upload { file, type: "selfie" }  →  { url }
PATCH /api/users/:userId { selfieUrl: url }
```

**Errors:**
- `400` — Missing `name`, `email`, `persona`, or `language`; or invalid values

#### `GET /api/users/:userId` — Get user profile

**Auth:** `X-User-Id` must match `:userId` (users can only read their own profile).

**Response:**
```json
{
  "userId": "abc-123",
  "name": "Anderson",
  "email": "anderson@example.com",
  "persona": "guide",
  "language": "en",
  "selfieUrl": "users/abc-123/selfie.jpg",
  "createdAt": "2026-02-27T10:00:00Z",
  "lastActiveAt": "2026-02-27T14:30:00Z"
}
```

**Errors:**
- `404` — User not found

#### `PATCH /api/users/:userId` — Update user profile

**Auth:** `X-User-Id` must match `:userId`.

**Request (partial update):**
```json
{
  "persona": "academic",
  "selfieUrl": "users/abc-123/selfie.jpg"
}
```

**Logic:**
1. Validate that only allowed fields are being updated: `persona`, `language`, `selfieUrl`, `name`, `email`
2. Add `lastActiveAt: FieldValue.serverTimestamp()` to the update
3. Merge-update the document
4. Return `200 { ok: true }`

**Errors:**
- `400` — Invalid field values
- `404` — User not found

---

## 8. Cloud Storage & Image Upload (Task 1.5)

### Storage Client (`services/storage.ts`)

**Initialization:**
```
- Create Storage instance with projectId from config
- Get bucket reference from GCS_BUCKET config
- Export helpers: uploadFile, getSignedUrl
```

### Cloud Storage Layout

```
{BUCKET}/
├── users/
│   └── {userId}/
│       ├── selfie.jpg                    ← User selfie from onboarding
│       ├── scans/
│       │   ├── {scanId}.jpg              ← Captured artwork photo
│       │   └── {scanId}_thumb.jpg        ← Compressed thumbnail (future)
│       └── generated/
│           └── {imageId}.png             ← AI-generated images (Phase 6)
```

### Endpoints

#### `POST /api/images/upload` — Upload an image

**Auth:** `X-User-Id` required.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | JPEG/PNG image |
| `type` | String | Yes | `selfie`, `scan`, or `generated` |
| `scanId` | String | Conditional | Required if `type` is `scan` |

**Multer config:**
- Max file size: `5MB`
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Storage: memory (buffer) — files are piped directly to Cloud Storage

**Logic:**
1. Validate `type` is one of: `selfie`, `scan`, `generated`
2. Determine Cloud Storage path:
   - `selfie` → `users/{userId}/selfie.jpg`
   - `scan` → `users/{userId}/scans/{scanId}.jpg`
   - `generated` → `users/{userId}/generated/{uuid}.png`
3. Upload buffer to Cloud Storage:
   - Content-Type from file MIME type
   - No public access (uniform bucket-level IAM)
4. Return `200 { url: "{storage-path}" }`

**Errors:**
- `400` — Missing file, invalid type, missing scanId for scan type
- `413` — File too large (>5MB)
- `415` — Unsupported MIME type

#### `GET /api/images/*` — Serve image via signed URL

**Auth:** `X-User-Id` required.

**Request:**
```
GET /api/images/users/abc-123/selfie.jpg
```

**Logic:**
1. Extract the storage path from the URL (everything after `/api/images/`)
2. Validate the path starts with `users/{requestingUserId}/` (users can only access their own images)
3. Check if the object exists in Cloud Storage
4. Generate a signed URL with 15-minute expiry:
   ```
   file.getSignedUrl({
     action: 'read',
     expires: Date.now() + 15 * 60 * 1000
   })
   ```
5. Return `302` redirect to the signed URL

**Errors:**
- `403` — Trying to access another user's images
- `404` — Image not found

---

## 9. Scan Endpoints (Task 1.6)

### Collection Schema

```
users/{userId}/scans/{scanId}
├── artworkTitle: string
├── artist: string
├── year: string
├── country: string
├── style: string
├── description: string
├── funFact: string
├── sources: [{ title: string, uri: string }]
├── annotations: [{ id: string, label: string, description: string, box_2d: [number, number, number, number] }]
├── deepAnalysis: {
│     historicalContext: string,
│     technicalAnalysis: string,
│     symbolism: string,
│     curiosities: [string]
│   }
├── capturedImageUrl: string
├── createdAt: Timestamp
└── language: string
```

### Endpoints

#### `POST /api/scans` — Save a scan result

**Auth:** `X-User-Id` required.

**Request:**
```json
{
  "artData": {
    "title": "The Starry Night",
    "artist": "Vincent van Gogh",
    "year": "1889",
    "country": "Netherlands",
    "style": "Post-Impressionism",
    "description": "...",
    "funFact": "...",
    "sources": [{ "title": "Wikipedia", "uri": "https://..." }],
    "annotations": [{ "id": "1", "label": "Cypress tree", "description": "...", "box_2d": [100, 50, 400, 200] }]
  },
  "capturedImageUrl": "users/abc-123/scans/scan-456.jpg",
  "language": "en"
}
```

**Logic:**
1. Generate scan ID via `uuid.v4()`
2. Flatten `artData` fields into the document (match Firestore schema)
3. Create document at `users/{userId}/scans/{scanId}`
4. Update user's `lastActiveAt`
5. Return `201 { scanId: "{scanId}" }`

#### `GET /api/users/:userId/scans` — List scan history

**Auth:** `X-User-Id` must match `:userId`.

**Logic:**
1. Query `users/{userId}/scans` ordered by `createdAt` descending
2. Limit to 50 results (paginate later if needed)
3. Return `200 { scans: [...] }`

**Response item shape:**
```json
{
  "scanId": "scan-456",
  "artworkTitle": "The Starry Night",
  "artist": "Vincent van Gogh",
  "year": "1889",
  "style": "Post-Impressionism",
  "capturedImageUrl": "users/abc-123/scans/scan-456.jpg",
  "createdAt": "2026-02-27T14:30:00Z",
  "language": "en"
}
```

**Note:** Return a summary (not the full document) to keep the response lightweight. Omit `description`, `funFact`, `annotations`, `deepAnalysis`, and `sources` from the list view. The frontend can fetch full details by loading the scan from history.

#### `PATCH /api/scans/:scanId/deep-analysis` — Update with deep analysis

**Auth:** `X-User-Id` required.

**Request:**
```json
{
  "deepAnalysis": {
    "historicalContext": "...",
    "technicalAnalysis": "...",
    "symbolism": "...",
    "curiosities": ["...", "...", "..."]
  }
}
```

**Logic:**
1. Find the scan document across all users (or require `userId` in the body/header)
2. Validate `deepAnalysis` has the required fields
3. Update the scan document with the `deepAnalysis` field
4. Return `200 { ok: true }`

**Implementation note:** Since we have `X-User-Id` in the header, look up the scan at `users/{userId}/scans/{scanId}`. This avoids a collection group query.

---

## 10. Chat Endpoints (Task 1.7)

### Collection Schema

```
users/{userId}/scans/{scanId}/chats/{messageId}
├── role: "user" | "model"
├── text: string
├── isAudioTranscription: boolean
└── createdAt: Timestamp
```

### Endpoints

#### `POST /api/scans/:scanId/chats` — Save a chat message

**Auth:** `X-User-Id` required.

**Request:**
```json
{
  "role": "user",
  "text": "What technique did the artist use?",
  "isAudioTranscription": false
}
```

**Logic:**
1. Validate `role` is `user` or `model`
2. Validate `text` is a non-empty string
3. Generate message ID via `uuid.v4()`
4. Create document at `users/{userId}/scans/{scanId}/chats/{messageId}`
5. Return `201 { messageId: "{messageId}" }`

#### `GET /api/scans/:scanId/chats` — Load chat history

**Auth:** `X-User-Id` required.

**Logic:**
1. Query `users/{userId}/scans/{scanId}/chats` ordered by `createdAt` ascending
2. Return `200 { messages: [...] }`

**Response item shape:**
```json
{
  "messageId": "msg-789",
  "role": "model",
  "text": "The artist employed impasto technique...",
  "isAudioTranscription": false,
  "createdAt": "2026-02-27T14:31:00Z"
}
```

---

## 11. Deployment (Task 1.8)

### Deployment Approach

Since the project uses `tsx` to run TypeScript directly (no compile step), deployment uses a Dockerfile that installs all deps and runs via `tsx`.

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server/ ./server/
COPY dist/ ./dist/
EXPOSE 8080
ENV PORT=8080
CMD ["node", "--import", "tsx", "server/index.ts"]
```

**Build steps:**
1. `npm run build` (Vite frontend build → `dist/`)
2. `docker build -t artlens-ai .`

**Note:** The Dockerfile has not been created yet — it will be created during deployment (Task 1.8). The above is the planned approach.

### Cloud Run Deployment

```bash
# Option A: Direct source deploy (simplest)
gcloud run deploy artlens-ai \
  --source=. \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=your-project,GCS_BUCKET=artlens-ai-media" \
  --min-instances=1 \
  --max-instances=5 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=900 \
  --session-affinity

# Option B: Build and push container
gcloud builds submit --tag gcr.io/your-project/artlens-ai .
gcloud run deploy artlens-ai \
  --image=gcr.io/your-project/artlens-ai \
  --region=us-central1 \
  ...same flags as above...
```

**Key Cloud Run configuration:**

| Setting | Value | Reason |
|---------|-------|--------|
| `--region` | `us-central1` | Same region as Vertex AI Live API for lowest latency |
| `--allow-unauthenticated` | Yes | Frontend needs direct access (auth is via `X-User-Id`) |
| `--min-instances` | `1` | Avoid cold starts during the event |
| `--max-instances` | `5` | Cap costs (~200 users max) |
| `--timeout` | `900` (15 min) | WebSocket sessions can last up to 15 minutes |
| `--session-affinity` | Yes | WebSocket connections need sticky routing |
| `--memory` | `512Mi` | Sufficient for proxying + image upload buffering |
| `--cpu` | `1` | Single CPU is sufficient for the event scale |

### Service Account Permissions

The Cloud Run service account needs:

| Role | Purpose |
|------|---------|
| `roles/aiplatform.user` | Vertex AI API access (text + live) |
| `roles/datastore.user` | Firestore read/write |
| `roles/storage.objectAdmin` | Cloud Storage upload/download/signed URLs |

```bash
SA="YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com"
PROJECT="your-project-id"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"
```

---

## 12. Testing Plan

### Local Development Testing

Run the proxy locally with ADC:

```bash
npm install
gcloud auth application-default login
cp .env.example .env
# Edit .env with your GCP project ID and bucket name
npm run dev:server
```

### Endpoint Verification via `curl`

#### Health Check
```bash
curl http://localhost:3001/health
# Expected: { "status": "ok" }
```

#### Create User
```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Anderson","email":"anderson@example.com","persona":"guide","language":"en"}'
# Expected: 201 { "userId": "abc-123-..." }
```

#### Get User
```bash
curl http://localhost:3001/api/users/{userId} \
  -H "X-User-Id: {userId}"
# Expected: 200 { user profile }
```

#### Update User
```bash
curl -X PATCH http://localhost:3001/api/users/{userId} \
  -H "Content-Type: application/json" \
  -H "X-User-Id: {userId}" \
  -d '{"persona":"academic"}'
# Expected: 200 { "ok": true }
```

#### Vertex AI Text Generation
```bash
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -H "X-User-Id: {userId}" \
  -d '{
    "contents": [{"role":"user","parts":[{"text":"Say hello in 5 words"}]}],
    "generationConfig": {}
  }'
# Expected: 200 { Vertex AI response with candidates }
```

#### Upload Image
```bash
curl -X POST http://localhost:3001/api/images/upload \
  -H "X-User-Id: {userId}" \
  -F "file=@test-image.jpg" \
  -F "type=selfie"
# Expected: 200 { "url": "users/{userId}/selfie.jpg" }
```

#### Get Image (Signed URL)
```bash
curl -v http://localhost:3001/api/images/users/{userId}/selfie.jpg \
  -H "X-User-Id: {userId}"
# Expected: 302 redirect to signed Cloud Storage URL
```

#### Save Scan
```bash
curl -X POST http://localhost:3001/api/scans \
  -H "Content-Type: application/json" \
  -H "X-User-Id: {userId}" \
  -d '{
    "artData": {
      "title":"Mona Lisa","artist":"Leonardo da Vinci","year":"1503",
      "country":"Italy","style":"Renaissance","description":"...","funFact":"...",
      "sources":[],"annotations":[]
    },
    "capturedImageUrl":"users/{userId}/scans/test.jpg",
    "language":"en"
  }'
# Expected: 201 { "scanId": "scan-..." }
```

#### List Scans
```bash
curl http://localhost:3001/api/users/{userId}/scans \
  -H "X-User-Id: {userId}"
# Expected: 200 { "scans": [...] }
```

#### Update Deep Analysis
```bash
curl -X PATCH http://localhost:3001/api/scans/{scanId}/deep-analysis \
  -H "Content-Type: application/json" \
  -H "X-User-Id: {userId}" \
  -d '{
    "deepAnalysis": {
      "historicalContext":"...","technicalAnalysis":"...","symbolism":"...",
      "curiosities":["fact1","fact2","fact3"]
    }
  }'
# Expected: 200 { "ok": true }
```

#### Save Chat Message
```bash
curl -X POST http://localhost:3001/api/scans/{scanId}/chats \
  -H "Content-Type: application/json" \
  -H "X-User-Id: {userId}" \
  -d '{"role":"user","text":"Tell me about this painting","isAudioTranscription":false}'
# Expected: 201 { "messageId": "msg-..." }
```

#### Load Chat History
```bash
curl http://localhost:3001/api/scans/{scanId}/chats \
  -H "X-User-Id: {userId}"
# Expected: 200 { "messages": [...] }
```

#### WebSocket Live API (via `wscat`)
```bash
npx wscat -c ws://localhost:3001/ws/live
# Then send setup message:
> {"setup":{"model":"projects/{PROJECT}/locations/us-central1/publishers/google/models/gemini-live-2.5-flash-native-audio","generation_config":{"response_modalities":["AUDIO"]},"system_instruction":{"parts":[{"text":"You are a helpful assistant"}]}}}
# Expected: receive {"setupComplete":{}} back
```

### Cloud Run Deployment Verification

After deploying, repeat the same `curl` tests against the Cloud Run URL:

```bash
PROXY_URL=$(gcloud run services describe artlens-ai-proxy --region=us-central1 --format='value(status.url)')

curl $PROXY_URL/health
# Repeat all curl tests above, replacing localhost:3001 with $PROXY_URL
```

---

## 13. GCP Prerequisites

Complete these before writing any code:

```
- [ ] GCP project exists with billing enabled
- [ ] Enable APIs:
  - [ ] Vertex AI API (aiplatform.googleapis.com)
  - [ ] Cloud Firestore API (firestore.googleapis.com)
  - [ ] Cloud Storage API (storage.googleapis.com)
  - [ ] Cloud Run API (run.googleapis.com)
  - [ ] Cloud Build API (cloudbuild.googleapis.com) — if using container builds
- [ ] Create Firestore database:
  - [ ] Mode: Native
  - [ ] Region: us-central1 (same as Cloud Run)
- [ ] Create Cloud Storage bucket:
  - [ ] Name: artlens-ai-media (or project-specific name)
  - [ ] Region: us-central1
  - [ ] Storage class: Standard
  - [ ] Access control: Uniform (bucket-level IAM only)
  - [ ] Lifecycle rule: auto-delete after 90 days (optional, configurable)
- [ ] Local development:
  - [ ] gcloud CLI installed
  - [ ] gcloud auth application-default login
  - [ ] gcloud config set project {PROJECT_ID}
- [ ] Service account (for Cloud Run):
  - [ ] roles/aiplatform.user
  - [ ] roles/datastore.user
  - [ ] roles/storage.objectAdmin
```

### GCP Setup Commands

```bash
PROJECT_ID="your-project-id"
REGION="us-central1"

# Set project
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com

# Create Firestore database (Native mode)
gcloud firestore databases create \
  --location=$REGION \
  --type=firestore-native

# Create Cloud Storage bucket
gcloud storage buckets create gs://artlens-ai-media \
  --location=$REGION \
  --uniform-bucket-level-access

# Set lifecycle rule (auto-delete after 90 days)
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 90}
    }
  ]
}
EOF
gcloud storage buckets update gs://artlens-ai-media --lifecycle-file=/tmp/lifecycle.json

# Local ADC
gcloud auth application-default login
```

---

## Appendix: Code Review — Frontend Alignment

This section documents the gaps found by reviewing Phase 1 against the current frontend code, and how each was resolved in this spec.

### Resolved in This Spec

| # | Gap | Resolution |
|---|-----|------------|
| 1 | Model name defaults didn't match migration doc | Updated defaults to `gemini-3-flash-preview` (text), `gemini-live-2.5-flash-native-audio` (live) |
| 2 | Onboarding flow updated to 3-step wizard: email+name → selfie → persona | `POST /api/users` requires `name`, `email`, `persona`, `language` |
| 3 | `contents` format mismatch (SDK sends object, Vertex AI expects array) | Added input normalization rule: proxy wraps single object in array, defaults `role` to `"user"` |
| 4 | No documentation for multi-turn chat via `/api/generate` | Added multi-turn chat example showing full history in `contents` |
| 5 | Response format mismatch (`response.text` vs nested path) | Proxy adds convenience `text` field at top level |
| 6 | WebSocket message format responsibility unclear | Documented: proxy is pure pass-through, frontend (Phase 2) sends Vertex AI snake_case format |
| 7 | `language` flow: set on different screen than onboarding | Documented: `language` passed from `App.tsx` state to `POST /api/users`, not from `OnboardingForm` |

### Deferred to Phase 2 (Frontend Migration)

These items require frontend code changes and are NOT in scope for Phase 1:

| # | Item | Current Code | Phase 2 Change |
|---|------|-------------|----------------|
| 1 | SDK → proxy HTTP calls | `geminiService.ts` uses `ai.models.generateContent()` | Replace with `fetch('/api/generate', ...)` |
| 2 | SDK → proxy chat | `useGeminiChat.ts` uses `ai.chats.create()` + `sendMessage()` | Replace with `fetch('/api/generate')` with full history in `contents` |
| 3 | SDK → proxy WebSocket | `useGeminiLive.ts` uses `ai.live.connect()` | Replace with `new WebSocket('/ws/live')` + Vertex AI message format |
| 4 | Tool name mapping | `{ googleSearch: {} }` | Change to `{ googleSearchRetrieval: {} }` |
| 5 | `@google/genai` Blob import | `audioUtils.ts` imports `Blob` from SDK | Define local `AudioBlob` type |
| 6 | camelCase → snake_case | Live API setup uses SDK camelCase fields | Convert to Vertex AI snake_case (`response_modalities`, etc.) |
| 7 | `systemInstruction` format | SDK accepts string | Vertex AI requires `{ parts: [{ text: "..." }] }` |
| 8 | History image URLs | `HistoryItem.imageUrl` stores full base64 data URL | Store Cloud Storage path, resolve via `/api/images/` |

### Current Frontend Types (Reference)

```typescript
// types.ts — fields the proxy must handle
export type Persona = 'guide' | 'academic' | 'blogger';
export type Language = 'en' | 'pt' | 'es';

// Current type — will be updated in Phase 4 to match new onboarding flow
export interface UserContext {
  name: string;
  persona: Persona;
  // Phase 4 additions: email, selfieUrl
}

export interface ArtData {
  title: string; artist: string; year: string;
  country: string; style: string; description: string; funFact: string;
}

export interface IdentifyResponse extends ArtData {
  sources: { title?: string; uri?: string }[];
  deepAnalysis?: {
    historicalContext: string; technicalAnalysis: string;
    symbolism: string; curiosities: string[];
  };
  annotations?: {
    id: string; label: string; description: string;
    box_2d: [number, number, number, number];
  }[];
}

export interface ChatMessage {
  id: string; role: 'user' | 'model'; text: string;
  timestamp: number; isAudioTranscription?: boolean;
}
```
