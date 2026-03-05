# Persistence Architecture — ArtLens AI

## Goal

Replace client-side `localStorage` with a cloud-backed system of record that persists every user interaction — profile, scans, chat, and generated images — across devices and sessions.

## Stack

| Service | Role |
|---------|------|
| **Cloud Run** | Backend proxy (already planned for Vertex AI migration) — adds REST endpoints for persistence |
| **Cloud Firestore** (Native mode) | Document database for user profiles, scan records, chat history |
| **Cloud Storage** | Binary blob storage for captured artwork photos, user selfies, and generated images |

```
┌──────────────┐         ┌──────────────────────┐
│   Browser    │────────▶│   Cloud Run Proxy     │
│   (React)    │◀────────│                       │
│              │         │  /api/users            │──▶  Firestore
│              │         │  /api/scans            │──▶  Firestore
│              │         │  /api/images/upload     │──▶  Cloud Storage
│              │         │  /api/images/:id        │◀──  Cloud Storage (signed URL)
│              │         │  /api/generate (Vertex) │──▶  Vertex AI
│              │         │  /ws/live   (Vertex)    │──▶  Vertex AI
│              │         │                       │
│              │         │  ADC auth to GCP       │
└──────────────┘         └──────────────────────┘
```

All GCP calls are server-side via ADC. The browser never touches Firestore or Cloud Storage directly.

---

## Firestore Data Model

### Collection: `users`

One document per user, keyed by a generated UUID (created at onboarding).

```
users/{userId}
├── email: string
├── name: string
├── persona: "guide" | "academic" | "blogger"
├── language: "en" | "pt" | "es"
├── selfieUrl: string (Cloud Storage path)
├── createdAt: timestamp
└── lastActiveAt: timestamp
```

### Collection: `scans`

One document per artwork scan, nested under the user.

```
users/{userId}/scans/{scanId}
├── artworkTitle: string
├── artist: string
├── year: string
├── country: string
├── style: string
├── description: string
├── funFact: string
├── sources: [{ title, uri }]
├── annotations: [{ id, label, description, box_2d }]
├── deepAnalysis: {
│     historicalContext: string,
│     technicalAnalysis: string,
│     symbolism: string,
│     curiosities: [string]
│   }
├── capturedImageUrl: string (Cloud Storage path)
├── createdAt: timestamp
└── language: string
```

### Collection: `chats`

Chat messages for each scan session.

```
users/{userId}/scans/{scanId}/chats/{messageId}
├── role: "user" | "model"
├── text: string
├── isAudioTranscription: boolean
└── createdAt: timestamp
```

### Collection: `generatedImages`

User-generated artwork images (the "nano banana" persona-in-artwork feature).

```
users/{userId}/generatedImages/{imageId}
├── scanId: string (reference to the source scan)
├── artworkTitle: string
├── imageUrl: string (Cloud Storage path)
├── prompt: string (the generation prompt used)
└── createdAt: timestamp
```

---

## Cloud Storage Layout

Single bucket, organized by user.

```
artlens-ai-media/
├── users/
│   └── {userId}/
│       ├── selfie.jpg
│       ├── scans/
│       │   ├── {scanId}.jpg          ← captured artwork photo
│       │   └── {scanId}_thumb.jpg    ← compressed thumbnail for history
│       └── generated/
│           └── {imageId}.png         ← AI-generated images
```

**Bucket configuration:**
- Location: same region as Cloud Run (e.g. `europe-west1` for MNAC proximity, or `us-central1` for Vertex AI proximity)
- Storage class: Standard
- Lifecycle: auto-delete after 90 days (configurable)
- Access: Uniform bucket-level (no per-object ACLs) — all access via signed URLs through the proxy

---

## Cloud Run API Endpoints

These endpoints extend the proxy server already planned in `MIGRATION_VERTEX_AI.md`.

### User Management

```
POST   /api/users              ← Create user at onboarding
GET    /api/users/:userId      ← Get user profile
PATCH  /api/users/:userId      ← Update persona, language, etc.
```

### Image Upload

```
POST   /api/images/upload      ← Upload image (selfie or scan capture)
       Body: multipart/form-data { file, userId, type: "selfie"|"scan"|"generated" }
       Returns: { url: "users/{userId}/scans/{scanId}.jpg" }

GET    /api/images/:path*      ← Serve image via signed URL redirect
       Returns: 302 redirect to short-lived signed URL
```

### Scan Records

```
POST   /api/scans              ← Save a scan result
       Body: { userId, artData, language }
       Returns: { scanId }

GET    /api/users/:userId/scans            ← List scan history
PATCH  /api/scans/:scanId/deep-analysis    ← Update with deep analysis when it completes
```

### Chat Messages

```
POST   /api/scans/:scanId/chats   ← Save a chat message
       Body: { userId, role, text, isAudioTranscription }

GET    /api/scans/:scanId/chats   ← Load chat history for a scan
```

### Generated Images

```
POST   /api/generated-images      ← Save a generated image record
GET    /api/users/:userId/gallery  ← List all generated images for the gallery view
```

---

## Frontend Integration

### Onboarding Flow

The onboarding is a 3-step wizard: email+name → selfie → persona.

```
1. Step 1: User enters name and email
2. Step 2: User takes a selfie (front camera)
3. Step 3: User selects persona (Classic Guide / Historian / Influencer)
4. On submit:
   a. POST /api/users { email, persona, language } → returns { userId }
   b. POST /api/images/upload (selfie, type: "selfie") → returns { url }
   c. PATCH /api/users/:userId { selfieUrl: url }
5. Store userId in localStorage (session key only)
```

### Scan Flow

```
1. User captures artwork photo
2. POST /api/images/upload (scan image) → returns { url, scanId }
3. Call Vertex AI via proxy (existing flow) → get artData
4. POST /api/scans { userId, artData, capturedImageUrl }
5. When deep analysis completes:
   PATCH /api/scans/:scanId/deep-analysis
```

### Chat Flow

```
1. Each message sent/received:
   POST /api/scans/:scanId/chats { role, text }
2. On revisiting a scan from history:
   GET /api/scans/:scanId/chats → restore conversation
```

### History & Gallery

```
1. GET /api/users/:userId/scans → populate HistoryDrawer
2. GET /api/users/:userId/gallery → populate virtual gallery
3. Images served via GET /api/images/:path → signed URL redirect
```

---

## Authentication

Keep it simple — no OAuth or Firebase Auth for the event:

1. At onboarding, generate a UUID `userId` on the server
2. Return it to the client; store in `localStorage`
3. All subsequent requests include `userId` as a header (`X-User-Id`)
4. The proxy validates that the `userId` exists in Firestore before serving data
5. For the event scope (single museum, short timeframe), this is sufficient

**Future:** Swap to Firebase Auth or Google Sign-In if the app goes beyond a single event.

---

## Implementation Checklist

```
- [ ] GCP setup
  - [ ] Create Firestore database (Native mode, same region as Cloud Run)
  - [ ] Create Cloud Storage bucket (artlens-ai-media)
  - [ ] Grant Cloud Run service account: Firestore User + Storage Object Admin

- [ ] Extend Cloud Run proxy (server/proxy.ts)
  - [ ] Add Firestore client (@google-cloud/firestore)
  - [ ] Add Cloud Storage client (@google-cloud/storage)
  - [ ] POST /api/users
  - [ ] POST /api/images/upload (multer for multipart)
  - [ ] GET /api/images/:path* (signed URL)
  - [ ] POST /api/scans
  - [ ] PATCH /api/scans/:scanId/deep-analysis
  - [ ] POST /api/scans/:scanId/chats
  - [ ] GET /api/scans/:scanId/chats
  - [ ] GET /api/users/:userId/scans
  - [ ] GET /api/users/:userId/gallery
  - [ ] POST /api/generated-images

- [ ] Frontend changes
  - [ ] Create services/apiClient.ts (fetch wrapper with userId header)
  - [ ] Update OnboardingForm: POST user + upload selfie
  - [ ] Update App.tsx: load userId from localStorage, fetch history on mount
  - [ ] Update processImageAnalysis: upload image + save scan
  - [ ] Update executeDeepAnalysis: PATCH deep analysis
  - [ ] Update ChatWindow: save messages, load on mount
  - [ ] Update HistoryDrawer: fetch from API instead of localStorage
  - [ ] Keep localStorage as offline fallback / cache

- [ ] Proxy dependencies
  - [ ] @google-cloud/firestore
  - [ ] @google-cloud/storage
  - [ ] multer (multipart file upload)
  - [ ] uuid (user ID generation)
```

---

## Proxy Dependencies

Add to the proxy server's `package.json`:

```json
{
  "dependencies": {
    "@google-cloud/firestore": "^7.0.0",
    "@google-cloud/storage": "^7.0.0",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.0",
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "google-auth-library": "^9.0.0"
  }
}
```

---

## Cost Estimate (Event Scope: ~200 users, 1 day)

| Service | Estimate | Notes |
|---------|----------|-------|
| **Firestore** | Free tier | <50K reads/20K writes per day |
| **Cloud Storage** | ~$0.05 | ~200 selfies + ~1000 scan images at <1MB each |
| **Cloud Run** | ~$1-5 | Single instance, auto-scales down to 0 |
| **Total** | **< $10** | Well within free tier for event scale |
