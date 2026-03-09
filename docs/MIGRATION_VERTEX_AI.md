# Migration Guide: Gemini API Key → Vertex AI with ADC

## Overview

This document covers migrating ArtLens AI from the current **Gemini Developer API** (API key auth) to **Vertex AI** (Application Default Credentials / ADC).

### What Changes

| Aspect | Current (Gemini API) | Target (Vertex AI) |
|---|---|---|
| **Auth** | API key via `process.env.API_KEY` | ADC (Application Default Credentials) |
| **Text Model** | `gemini-2.5-flash` | `gemini-3-flash-preview` |
| **Text Region** | N/A (global) | `global` |
| **Voice Model** | `gemini-2.5-flash-native-audio-preview-12-2025` | `gemini-live-2.5-flash-native-audio` |
| **Voice Region** | N/A | `us-central1` |
| **Text SDK** | `@google/genai` with API key | `@google/genai` with Vertex AI config (via backend proxy) |
| **Live API** | `@google/genai` `ai.live.connect()` | WebSocket via proxy server (ADC-authenticated) |
| **Model URI** | Simple model name string | `projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL}` |
| **Endpoint** | `generativelanguage.googleapis.com` | `{REGION}-aiplatform.googleapis.com` |

### Why a Proxy is Required

ADC uses service account credentials or user credentials from `gcloud auth`. These **cannot be exposed in browser code**. The migration requires a **backend proxy server** that:

1. Authenticates with Google Cloud using ADC
2. Forwards requests from the browser to Vertex AI
3. For the Live API: maintains a WebSocket bridge between browser ↔ Vertex AI

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  Browser  │────▶│  Proxy Server │────▶│  Vertex AI API   │
│  (React)  │◀────│  (Node.js)    │◀────│  (us-central1)   │
│           │     │  ADC Auth     │     │                  │
└──────────┘     └──────────────┘     └──────────────────┘
     HTTP/WS          HTTPS/WSS            gRPC/REST
```

---

## Files That Need Changes

### Direct Changes Required

| File | Current | Change |
|---|---|---|
| `services/geminiService.ts:1,4,6` | `GoogleGenAI` with API key, model `gemini-2.5-flash` | Route through backend proxy, update model to `gemini-3-flash-preview` |
| `hooks/useGeminiChat.ts:2,32,46` | `GoogleGenAI` with API key, model `gemini-2.5-flash` | Route through backend proxy, update model |
| `hooks/useGeminiLive.ts:2,109,125,173-183` | `GoogleGenAI` with API key, SDK `ai.live.connect()` | Replace with WebSocket client connecting to proxy |
| `utils/audioUtils.ts:1` | Imports `Blob` from `@google/genai` | Define local `Blob` type or import from proxy types |
| `vite.config.ts:14-15` | Injects `GEMINI_API_KEY` | Inject `PROXY_URL` and `PROJECT_ID` instead |
| `.env.local` | `GEMINI_API_KEY=...` | `VITE_PROXY_URL=...` and `VITE_PROJECT_ID=...` |

### New Files Required

| File | Purpose |
|---|---|
| `server/proxy.ts` (or `proxy.js`) | WebSocket + HTTP proxy server with ADC auth |
| `services/vertexAIClient.ts` | Client-side wrapper for proxy communication |
| `services/geminiLiveClient.ts` | WebSocket client for Live API (replaces SDK usage) |

---

## Step-by-Step Migration

### Step 1: Environment Variables

**Before** (`.env.local`):
```
GEMINI_API_KEY=AIza...
```

**After** (`.env.local`):
```
VITE_PROXY_URL=http://localhost:8080
VITE_PROJECT_ID=your-gcp-project-id
VITE_REGION_LIVE=us-central1
VITE_REGION_TEXT=global
```

**Update `vite.config.ts`:**

```typescript
// Before
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
},

// After
define: {
  'process.env.PROXY_URL': JSON.stringify(env.VITE_PROXY_URL),
  'process.env.PROJECT_ID': JSON.stringify(env.VITE_PROJECT_ID),
  'process.env.REGION_LIVE': JSON.stringify(env.VITE_REGION_LIVE || 'us-central1'),
  'process.env.REGION_TEXT': JSON.stringify(env.VITE_REGION_TEXT || 'global'),
},
```

---

### Step 2: Backend Proxy Server

Create a Node.js proxy that handles both HTTP (text API) and WebSocket (Live API) connections.

**`server/proxy.ts`** — Key responsibilities:
- Obtain access tokens via ADC (`google-auth-library`)
- HTTP endpoint for text generation requests (POST `/api/generate`)
- WebSocket endpoint for Live API (`/ws/live`)
- Forward all messages between browser WebSocket and Vertex AI WebSocket

**Auth pattern using ADC:**
```typescript
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}
```

**Proxy WebSocket flow:**
```
Browser ──WS──▶ Proxy Server ──WSS──▶ Vertex AI Live API
                     │
                     ├─ On browser connect:
                     │   1. Get ADC access token
                     │   2. Open WSS to Vertex AI endpoint
                     │   3. Bridge messages bidirectionally
                     │
                     ├─ On browser message:
                     │   Forward to Vertex AI WebSocket
                     │
                     └─ On Vertex AI message:
                         Forward to browser WebSocket
```

**Vertex AI Live API WebSocket URL:**
```
wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent
```

**Proxy dependencies to add:**
```json
{
  "dependencies": {
    "google-auth-library": "^9.0.0",
    "express": "^4.18.0",
    "ws": "^8.16.0"
  }
}
```

---

### Step 3: Migrate Text API (`geminiService.ts`)

The text API calls (`identifyArtwork`, `getDeepArtworkAnalysis`) currently use the SDK directly. Two migration options:

#### Option A: Proxy All Text Calls (Recommended)

Route text generation through the proxy server's HTTP endpoint.

**Before** (`services/geminiService.ts:4-6,144-158`):
```typescript
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_ID = 'gemini-2.5-flash';

// ...
const response = await ai.models.generateContent({
  model: MODEL_ID,
  contents: { parts: [imagePart, { text: prompt }] },
  config: { tools: [{ googleSearch: {} }] }
});
```

**After:**
```typescript
const PROXY_URL = process.env.PROXY_URL;
const MODEL_ID = 'gemini-3-flash-preview';

async function generateContent(params: {
  contents: any;
  config?: any;
}): Promise<any> {
  const response = await fetch(`${PROXY_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_ID,
      ...params,
    }),
  });
  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  return response.json();
}
```

The proxy server receives this, constructs the Vertex AI request with ADC auth, and forwards it:
```typescript
// Proxy-side: POST /api/generate
const VERTEX_ENDPOINT = `https://global-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models`;

app.post('/api/generate', async (req, res) => {
  const token = await getAccessToken();
  const { model, contents, config } = req.body;

  const vertexResponse = await fetch(
    `${VERTEX_ENDPOINT}/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: Array.isArray(contents) ? contents : [contents],
        generationConfig: config,
        // Google Search grounding in Vertex AI format:
        tools: config?.tools || [],
      }),
    }
  );
  const data = await vertexResponse.json();
  res.json(data);
});
```

#### Option B: Server-side Token Fetch + Client SDK

Keep using `@google/genai` on the client, but fetch a short-lived access token from the proxy:

```typescript
// Client: fetch token from proxy
const tokenResponse = await fetch(`${PROXY_URL}/api/token`);
const { token } = await tokenResponse.json();

// Use SDK with Vertex AI config
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.PROJECT_ID,
  location: 'global',
  googleAuthOptions: { credentials: { access_token: token } },
});
```

> **Note:** Option A is more secure since credentials never reach the browser.

---

### Step 4: Migrate Chat API (`useGeminiChat.ts`)

**Before** (`hooks/useGeminiChat.ts:32,46`):
```typescript
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
chatRef.current = ai.chats.create({
  model: 'gemini-2.5-flash',
  // ...
});
```

**After** — two approaches:

#### Approach A: Proxy-based chat (stateless)
Send full message history with each request through the proxy. The proxy calls Vertex AI `generateContent` with the conversation history.

#### Approach B: Keep SDK with token refresh
If using Option B from Step 3, the chat SDK can still work:
```typescript
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.PROJECT_ID,
  location: 'global',
});
chatRef.current = ai.chats.create({
  model: 'gemini-3-flash-preview',
  // ... rest stays the same
});
```

---

### Step 5: Migrate Live API (`useGeminiLive.ts`) — Major Change

This is the most significant change. The current SDK-based `ai.live.connect()` must be replaced with a **WebSocket client** that connects through the proxy.

**Before** (`hooks/useGeminiLive.ts:109,173-183`):
```typescript
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const session = ai.live.connect({
  model: modelId,
  config: {
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    systemInstruction: systemInstruction,
  },
  callbacks: { onopen, onmessage, onclose, onerror }
});
```

**After** — WebSocket client pattern (based on provided example):

```typescript
const PROXY_URL = process.env.PROXY_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const LIVE_MODEL = 'gemini-live-2.5-flash-native-audio';
const REGION = 'us-central1';

// Model URI for Vertex AI
const MODEL_URI = `projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${LIVE_MODEL}`;

// Vertex AI WebSocket service URL
const SERVICE_URL = `wss://${REGION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

// Connect to proxy WebSocket
const wsUrl = PROXY_URL.replace('http', 'ws') + '/ws/live';
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  // Step 1: Tell proxy which Vertex AI service to connect to
  ws.send(JSON.stringify({ service_url: SERVICE_URL }));

  // Step 2: Send session setup
  ws.send(JSON.stringify({
    setup: {
      model: MODEL_URI,
      generation_config: {
        response_modalities: ['AUDIO'],
        temperature: 1.0,
        speech_config: {
          voice_config: {
            prebuilt_voice_config: { voice_name: 'Kore' },
          },
        },
        enable_affective_dialog: true,
      },
      system_instruction: { parts: [{ text: systemInstruction }] },
      input_audio_transcription: {},
      output_audio_transcription: {},
      realtime_input_config: {
        automatic_activity_detection: {
          disabled: false,
          silence_duration_ms: 2000,
          prefix_padding_ms: 500,
        },
      },
    },
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Parse using same structure as current SDK callbacks
  // data.setupComplete → session ready
  // data.serverContent.modelTurn.parts[0].inlineData.data → audio
  // data.serverContent.outputTranscription.text → model transcript
  // data.serverContent.inputTranscription.text → user transcript
  // data.serverContent.turnComplete → turn done
  // data.serverContent.interrupted → interruption
};

// Send audio (replaces session.sendRealtimeInput)
function sendAudio(base64PCM: string) {
  ws.send(JSON.stringify({
    realtime_input: {
      media_chunks: [{
        mime_type: 'audio/pcm',
        data: base64PCM,
      }],
    },
  }));
}

// Send text (replaces session.sendClientContent)
function sendText(text: string) {
  ws.send(JSON.stringify({
    client_content: {
      turns: [{ parts: [{ text }] }],
    },
  }));
}
```

#### Key Differences in Message Format

| SDK Method | Vertex AI WebSocket |
|---|---|
| `session.sendRealtimeInput({ media: blob })` | `{ realtime_input: { media_chunks: [{ mime_type, data }] } }` |
| `session.sendClientContent({ turns })` | `{ client_content: { turns: [{ parts: [{ text }] }] } }` |
| Callback `msg.serverContent.modelTurn.parts` | Same structure in parsed JSON |
| Callback `msg.serverContent.outputTranscription` | Same structure |
| Callback `msg.serverContent.turnComplete` | Same structure |
| Callback `msg.serverContent.interrupted` | Same structure |

#### New Features Available in Vertex AI Live API

The Vertex AI Live API exposes features not available in the Developer API:

| Feature | Config Key | Description |
|---|---|---|
| **Affective Dialog** | `generation_config.enable_affective_dialog` | Emotional awareness in voice responses |
| **Proactive Audio** | `proactivity.proactiveAudio` | Model initiates conversation |
| **Activity Detection Tuning** | `realtime_input_config.automatic_activity_detection` | Fine-tune silence duration, padding, sensitivity |
| **Activity Handling** | `realtime_input_config.activity_handling` | Control how the model handles user/model speech overlap |

---

### Step 6: Update `audioUtils.ts`

The `Blob` type is currently imported from `@google/genai`. Define it locally instead:

**Before** (`utils/audioUtils.ts:1`):
```typescript
import { Blob } from '@google/genai';
```

**After:**
```typescript
// Local type — matches the Vertex AI media chunk format
export interface AudioBlob {
  data: string;      // base64 encoded PCM
  mimeType: string;  // 'audio/pcm;rate=16000'
}
```

Update `createPcmBlob` return type from `Blob` to `AudioBlob`.

---

## Model Name Reference

### Text Generation

| Usage | Current Model | Vertex AI Model | Region | Endpoint |
|---|---|---|---|---|
| Artwork identification | `gemini-2.5-flash` | `gemini-3-flash-preview` | `global` | `global-aiplatform.googleapis.com` |
| Visual analysis | `gemini-2.5-flash` | `gemini-3-flash-preview` | `global` | `global-aiplatform.googleapis.com` |
| Deep analysis | `gemini-2.5-flash` | `gemini-3-flash-preview` | `global` | `global-aiplatform.googleapis.com` |
| Text chat | `gemini-2.5-flash` | `gemini-3-flash-preview` | `global` | `global-aiplatform.googleapis.com` |

### Live Audio

| Usage | Current Model | Vertex AI Model | Region | Endpoint |
|---|---|---|---|---|
| Voice chat | `gemini-2.5-flash-native-audio-preview-12-2025` | `gemini-live-2.5-flash-native-audio` | `us-central1` | `us-central1-aiplatform.googleapis.com` |

### Vertex AI Model URI Format

```
projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_NAME}
```

Examples:
```
# Text
projects/my-project/locations/global/publishers/google/models/gemini-3-flash-preview

# Live Audio
projects/my-project/locations/us-central1/publishers/google/models/gemini-live-2.5-flash-native-audio
```

---

## Google Search Grounding in Vertex AI

The search grounding tool syntax for Gemini 2.0+ models:

**Before (Gemini API):**
```typescript
config: { tools: [{ googleSearch: {} }] }
```

**After (Vertex AI):**
```typescript
tools: [{ google_search: {} }]
```

This affects `geminiService.ts` (the identification call).

---

## ADC Setup

### Local Development

```bash
# Install gcloud CLI, then:
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud auth application-default print-access-token
```

### Production (Cloud Run, GKE, etc.)

ADC is automatic — the service account attached to the compute resource is used. Ensure it has the `Vertex AI User` role:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

---

## Migration Checklist

```
- [ ] Set up GCP project with Vertex AI API enabled
- [ ] Configure ADC locally (`gcloud auth application-default login`)
- [ ] Grant `Vertex AI User` role to service account

- [ ] Create proxy server (`server/proxy.ts`)
  - [ ] HTTP endpoint for text generation (`POST /api/generate`)
  - [ ] WebSocket endpoint for Live API (`/ws/live`)
  - [ ] ADC token management with auto-refresh

- [ ] Update environment variables (`.env.local`, `vite.config.ts`)

- [ ] Migrate `services/geminiService.ts`
  - [ ] Replace SDK calls with proxy HTTP calls
  - [ ] Update model name to `gemini-3-flash-preview`
  - [ ] Update Google Search grounding syntax to `googleSearchRetrieval`
  - [ ] Update response parsing if Vertex AI response format differs

- [ ] Migrate `hooks/useGeminiChat.ts`
  - [ ] Route chat through proxy or use token-based SDK auth
  - [ ] Update model name to `gemini-3-flash-preview`

- [ ] Migrate `hooks/useGeminiLive.ts`
  - [ ] Replace `ai.live.connect()` with WebSocket client
  - [ ] Update model to `gemini-live-2.5-flash-native-audio`
  - [ ] Update message format (realtime_input, client_content)
  - [ ] Implement two-step setup (service_url + session config)
  - [ ] Map SDK callbacks to WebSocket message parsing
  - [ ] Consider enabling affective dialog and activity detection tuning

- [ ] Update `utils/audioUtils.ts`
  - [ ] Remove `@google/genai` Blob import
  - [ ] Define local AudioBlob type

- [ ] Test all flows
  - [ ] Language selection → Onboarding → Camera
  - [ ] Image scan (identification + visual analysis)
  - [ ] Deep analysis (async background)
  - [ ] Text chat
  - [ ] Voice chat (connect, mute/unmute, transcription, disconnect)
  - [ ] History recall

- [ ] Update `package.json` scripts for proxy server
- [ ] Update deployment configuration for proxy hosting
```

---

## Deployment Considerations

| Concern | Recommendation |
|---|---|
| **Proxy hosting** | Cloud Run (auto-scales, supports WebSocket, ADC built-in) |
| **Latency** | Deploy proxy in `us-central1` to minimize distance to Vertex AI Live API |
| **Token caching** | Cache ADC access tokens (valid ~1 hour), refresh proactively |
| **CORS** | Configure proxy to allow requests from your frontend domain |
| **Rate limiting** | Add rate limiting to proxy to prevent abuse |
| **Health checks** | Add `/health` endpoint to proxy for monitoring |
| **Logging** | Structured logging on proxy for debugging API errors |
