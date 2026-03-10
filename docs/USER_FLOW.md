# ArtLens AI — User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APP LAUNCH                                        │
│                                                                             │
│  ┌───────────────────┐    ┌───────────────────────┐    ┌─────────────────┐  │
│  │  Language Select   │───>│  Onboarding Wizard    │───>│  Main Camera    │  │
│  │                   │    │                       │    │     View        │  │
│  │  [EN] [PT] [ES]   │    │  Step 1: Name + Email │    │                 │  │
│  │                   │    │  Step 2: Selfie (cam)  │    │  Live camera    │  │
│  │  Persisted to     │    │  Step 3: Persona pick  │    │  feed with      │  │
│  │  localStorage     │    │                       │    │  HUD overlay    │  │
│  └───────────────────┘    │  ┌─────┐ ┌────┐ ┌───┐│    └────────┬────────┘  │
│                           │  │Guide│ │Hist│ │Inf││             │           │
│                           │  └─────┘ └────┘ └───┘│             │           │
│                           │                       │             │           │
│                           │  Creates user in      │             │           │
│                           │  Firestore + uploads  │             │           │
│                           │  selfie to GCS        │             │           │
│                           └───────────────────────┘             │           │
│                                                                 │           │
└─────────────────────────────────────────────────────────────────┼───────────┘
                                                                  │
                    ┌─────────────────────────────────────────────┘
                    │
                    v
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCAN ARTWORK                                        │
│                                                                             │
│   User taps shutter ─── or ─── uploads photo                               │
│        │                            │                                       │
│        v                            v                                       │
│   captureFrame()              FileReader                                    │
│        │                            │                                       │
│        └──────────┬─────────────────┘                                       │
│                   v                                                         │
│          processImageAnalysis()                                             │
│                   │                                                         │
│                   v                                                         │
│   ┌───────────────────────────────┐                                         │
│   │   identifyArtwork()          │                                          │
│   │   POST /api/generate         │                                          │
│   │                              │                                          │
│   │  Two parallel calls:         │                                          │
│   │  ┌────────────┐ ┌──────────┐ │                                          │
│   │  │ Search-    │ │ Vision   │ │                                          │
│   │  │ grounded   │ │ analysis │ │                                          │
│   │  │            │ │          │ │                                          │
│   │  │ title      │ │ style    │ │                                          │
│   │  │ artist     │ │ descrip. │ │                                          │
│   │  │ year       │ │ annotate │ │                                          │
│   │  │ country    │ │ bounding │ │                                          │
│   │  │ funFact    │ │ boxes    │ │                                          │
│   │  └────────────┘ └──────────┘ │                                          │
│   └──────────────┬────────────────┘                                         │
│                  │                                                          │
│                  v                                                          │
│        Result Card shown                                                    │
│                  │                                                          │
│     ┌────────────┼────────────────────┐                                     │
│     │            │                    │                                      │
│     v            v                    v                                      │
│  Deep Analysis  TTS Narration     Save to Firestore                         │
│  (async)        (async)           + upload image                            │
│                                   to GCS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                    │                   │
                    v                   v
┌──────────────────────────┐  ┌────────────────────────────────────────────┐
│   DEEP ANALYSIS          │  │   TTS NARRATION                            │
│                          │  │                                            │
│  getDeepArtworkAnalysis()│  │  Two-stage pipeline:                       │
│  POST /api/generate      │  │                                            │
│                          │  │  Stage 1: Flash Lite                       │
│  Returns:                │  │  ┌──────────────────────────┐              │
│  - historicalContext     │  │  │ Generate personalized    │              │
│  - technicalAnalysis     │  │  │ script based on:         │              │
│  - symbolism             │  │  │  - persona (tone/style)  │              │
│  - curiosities[]         │  │  │  - language              │              │
│                          │  │  │  - user's name           │              │
│  Persisted to Firestore  │  │  │  - artwork data          │              │
│  via PATCH /api/scans/   │  │  │ 2-3 sentences, ~15-20s   │              │
│  {scanId}/deep-analysis  │  │  └───────────┬──────────────┘              │
│                          │  │              │                              │
│  Injected into Live API  │  │              v                              │
│  system instruction if   │  │  Stage 2: Flash TTS                        │
│  voice chat is active    │  │  ┌──────────────────────────┐              │
└──────────────────────────┘  │  │ Synthesize speech        │              │
                              │  │  - SSE streaming          │              │
                              │  │  - PCM 16-bit 24kHz mono  │              │
                              │  │  - Voice per persona:     │              │
                              │  │    Guide  -> Zephyr       │              │
                              │  │    Histor -> Kore         │              │
                              │  │    Influe -> Puck         │              │
                              │  │  - Returns base64 WAV     │              │
                              │  └───────────┬──────────────┘              │
                              │              │                              │
                              │              v                              │
                              │  Auto-play via AudioContext                 │
                              │  Waveform indicator on card                │
                              │  Tap to stop                               │
                              └────────────────────────────────────────────┘

                    │
                    v
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RESULT CARD (AnalysisResultCard)                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Title / Artist / Year                          [Share] [Close]    │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  [Country] [Style]                                                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ||||| Narrating -- tap to stop          (while TTS playing)      │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                    │    │
│  │  [ Chat with Classic Guide / Historian / Influencer ]              │    │
│  │                                                                    │    │
│  │  [ Generate Me ]    (if selfie exists)                             │    │
│  │  [ Scan Another ]                                                  │    │
│  │                                                                    │    │
│  │  Description text...                                               │    │
│  │                                                                    │    │
│  │  ┌ Did You Know? ─────────────────────────────┐                    │    │
│  │  │ "fun fact about the artwork..."            │                    │    │
│  │  └────────────────────────────────────────────┘                    │    │
│  │                                                                    │    │
│  │  --- Deep Analysis (async, shimmer while loading) ---             │    │
│  │  Unique Insights: ...                                              │    │
│  │  Historical Context: ...                                           │    │
│  │  Technique: ...                                                    │    │
│  │  Symbolism: ...                                                    │    │
│  │                                                                    │    │
│  │  Sources: [domain1] [domain2] [domain3]                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Can minimize to a pill bar at the bottom                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
        │                          │
        │ tap "Chat with..."       │ tap annotation dot
        v                          v
┌──────────────────────────┐  ┌──────────────────────────┐
│   CHAT WINDOW            │  │   ANNOTATION CARD        │
│                          │  │                          │
│  Auto-starts voice       │  │  Shows detail for a      │
│  (WebSocket to Live API) │  │  specific region of      │
│                          │  │  the artwork             │
│  Narration script is     │  │                          │
│  injected into system    │  │  Navigate between        │
│  instruction so the      │  │  annotation points       │
│  guide doesn't repeat    │  │                          │
│  the TTS intro           │  └──────────────────────────┘
│                          │
│  ┌────────────────────┐  │
│  │ Voice Active bar   │  │
│  │ [Brief/Detailed]   │  │
│  │ [Disconnect]       │  │
│  └────────────────────┘  │
│                          │
│  Message bubbles         │
│  (text + voice           │
│   transcripts merged)    │
│                          │
│  ┌────────────────────┐  │
│  │ Topic Chips:       │  │
│  │ [Tell Story]       │  │
│  │ [About Artist]     │  │
│  │ [What's Nearby]    │  │
│  │ [Catalan Connect]  │  │
│  │ [Hidden Details]   │  │
│  │ [Compare Styles]   │  │
│  │ + annotation chips │  │
│  └────────────────────┘  │
│                          │
│  [Mute] [___input___]    │
│                  [Send]  │
└──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        OTHER FEATURES                                       │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐ │
│  │   HISTORY DRAWER     │  │   GENERATE ME MODAL  │  │   GALLERY         │ │
│  │                      │  │                      │  │                   │ │
│  │  Loaded from         │  │  Gemini image gen    │  │  View generated   │ │
│  │  Firestore           │  │  puts user into      │  │  images           │ │
│  │  (server-side)       │  │  the artwork style   │  │                   │ │
│  │                      │  │                      │  │  Download / Share │ │
│  │  Tap to reload       │  │  Requires selfie     │  │                   │ │
│  │  previous scan       │  │                      │  │                   │ │
│  │                      │  │  Saved to GCS +      │  │                   │ │
│  │  Cross-device sync   │  │  appears in Gallery  │  │                   │ │
│  └──────────────────────┘  └──────────────────────┘  └───────────────────┘ │
│                                                                             │
│  ┌──────────────────────┐                                                   │
│  │   SETTINGS MENU      │                                                   │
│  │                      │                                                   │
│  │  Logged in as: name  │                                                   │
│  │  email               │                                                   │
│  │  [Logout]            │                                                   │
│  └──────────────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND ARCHITECTURE                                   │
│                                                                             │
│  Browser                        Express (port 3001)        Google Cloud     │
│  ───────                        ──────────────────         ────────────     │
│                                                                             │
│  identifyArtwork() ──────> POST /api/generate ──────> Vertex AI            │
│  getDeepAnalysis() ──────> POST /api/generate ──────> (Flash Lite)         │
│                                                                             │
│  narration.generate() ───> POST /api/tts/narrate                           │
│                              │                                              │
│                              ├──> Flash Lite (script gen)                   │
│                              └──> Flash TTS  (audio gen) ──> Vertex AI     │
│                                                                             │
│  useGeminiLive ──────────> WS /ws/live ─────────────> Vertex AI Live API   │
│  (WebSocket)                 (bridge)                  (native audio)      │
│                                                                             │
│  apiPost/apiGet ─────────> /api/users                                      │
│                            /api/scans  ─────────────> Firestore            │
│                            /api/scans/:id/chats                            │
│                                                                             │
│  selfie/scan upload ────> /api/images/upload ───────> Cloud Storage (GCS)  │
│  image display <─────────  /api/images/users/... <─── (streaming proxy)    │
│                                                                             │
│  generateImage() ────────> /api/generate-image ─────> Vertex AI            │
│                                                        (Gemini Image)      │
│                                                                             │
│  Auth: X-User-Id header (UUID) validated against Firestore                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
