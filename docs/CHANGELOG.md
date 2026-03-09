# Changelog

## 2026-03-09 (session 2) — MNAC Museum Experience & Auth Resilience

### Added

- **Auto-narration on scan** — When the voice assistant connects after a scan, an opening prompt is automatically sent so the guide greets the visitor by name and immediately starts narrating about the artwork. No user interaction required — works like pressing play on an audio guide. (`components/ChatWindow.tsx`)

- **MNAC-aware system instruction** — The voice assistant now knows it's at the Museu Nacional d'Art de Catalunya. The system instruction includes museum context: Palau Nacional on Montjuïc, Romanesque murals from Pyrenean churches, Gothic altarpieces, Modernisme masters (Gaudí, Casas, Rusiñol, Mir), Thyssen-Bornemisza collection. The guide proactively suggests related works, references physical spaces ("in the next gallery"), and connects pieces to Catalan cultural identity. (`hooks/useGeminiLive.ts`)

- **Museum-relevant topic chips** — Replaced generic topic chips with visitor-oriented ones: "Tell me a story" (highlighted), "What's nearby?", "Catalan Connection", "Hidden Details", "Compare Styles". Annotation-based chips retained with improved prompts. Each chip sends a rich, contextual question. (`components/ChatWindow.tsx`)

- **Connecting UX states** — Three distinct empty states in the chat window: "Your guide is preparing..." (pulsing mic, during WebSocket setup), "Your guide is speaking" (audio bars, after connection), and the default idle state with manual start button. (`components/ChatWindow.tsx`)

- **Auto-retry on 401 (auth resilience)** — `apiClient.ts` now transparently handles stale or missing user sessions. On any 401 response, it re-registers the user from the saved `userContext` in localStorage, gets a fresh `userId`, and retries the request. Handles Firestore resets, stale sessions, and failed-onboarding edge cases without user intervention. (`services/apiClient.ts`)

- **8 new i18n keys** — Added translations (en/pt/es) for: `chat.tellStory`, `chat.whatsNearby`, `chat.catalanConnection`, `chat.compareStyles`, `chat.hiddenDetails`, `chat.guidePreparing`, `chat.guideNarrating`, `chat.askAnything`. (`utils/i18n.ts`)

### Changed

- **Persona instructions enriched** — Each persona (Classic Guide, Historian, Influencer) now has richer behavioral guidance. The system instruction includes a `BEHAVIOR` section emphasizing conversational tone, attention hooks, and honest handling of unknowns. (`hooks/useGeminiLive.ts`)

- **Deep analysis context improved** — `technicalAnalysis` is now included in the voice assistant's context alongside historicalContext, symbolism, and curiosities. (`hooks/useGeminiLive.ts`)

### Files Modified

| File | Change |
|------|--------|
| `hooks/useGeminiLive.ts` | MNAC system instruction, enriched personas, deep analysis context |
| `components/ChatWindow.tsx` | Auto-narration, museum topic chips, connecting UX states |
| `hooks/useGeminiChat.ts` | `messagesRef` pattern for reliable state reads |
| `services/apiClient.ts` | 401 auto-retry with user re-registration |
| `utils/i18n.ts` | 8 new translation keys (en/pt/es) |

---

## 2026-03-09 (session 1) — Voice Fix & Gemini 3.0 Migration

### Fixed

- **Voice conversation not responding to text input** — `sendTextInput()` in `useGeminiLive.ts` was missing `turn_complete: true` in the `client_content` WebSocket message. The Vertex AI Live API requires this flag to signal the client is done sending and the model should generate a response. Without it, the model waited indefinitely for more input, causing topic chips and typed messages in voice mode to produce no response.

- **Voice connection race condition** — `connect()` in `useGeminiLive.ts` returned immediately after creating the WebSocket, before `setupComplete` was received from Vertex AI. Code calling `await connect()` followed by `sendTextInput()` would race — the text was sent before the session was ready, silently lost. Fixed by wrapping the WebSocket setup in a `Promise` that resolves only when `setupComplete` arrives, matching the old SDK behavior of `ai.live.connect()`.

- **Fragile text chat implementation** — `sendMessage()` in `useGeminiChat.ts` fired async API calls inside React `setMessages()` callbacks (an anti-pattern). Errors could be swallowed and state updates were unpredictable. Replaced with a `messagesRef` to read current state and a straightforward `await apiPost()` call with proper try/catch/finally.

- **Removed unnecessary 500ms delay** — `handleTopicClick()` in `ChatWindow.tsx` used a `setTimeout(500)` between `connect()` and `sendTextInput()` as a workaround for the race condition above. Now that `connect()` is properly awaitable, the delay is no longer needed.

### Changed (earlier in session)

- **Upgraded to Gemini 3.0 preview models** — Text generation now uses `gemini-3-flash-preview` (region: global). Live audio uses `gemini-live-2.5-flash-native-audio` (region: us-central1).

- **Search grounding tool renamed** — `googleSearchRetrieval` replaced with `google_search` in `geminiService.ts` to match the current Vertex AI REST API. The old name now returns an error: *"google_search_retrieval is not supported; please use google_search field instead."*

- **Global region URL fix** — `getGenerateUrl()` in `server/services/vertexai.ts` now correctly builds `https://aiplatform.googleapis.com/...` for the `global` region instead of `https://global-aiplatform.googleapis.com/...`.

- **Improved error reporting** — `POST /api/generate` route now includes the actual Vertex AI error message in the 502 response instead of a generic string.

- **`speech_config` placement** — Moved `speech_config` inside `generation_config` in the Live API WebSocket setup message to match the Vertex AI BidiGenerateContent schema.

### Files Modified

| File | Change |
|------|--------|
| `hooks/useGeminiLive.ts` | Added `turn_complete: true`, made `connect()` awaitable via Promise |
| `hooks/useGeminiChat.ts` | Rewrote `sendMessage()` with `messagesRef` pattern, proper async/await |
| `components/ChatWindow.tsx` | Removed 500ms delay in `handleTopicClick()` |
| `services/geminiService.ts` | `googleSearchRetrieval` → `google_search` |
| `server/services/vertexai.ts` | Global region URL fix |
| `server/routes/generate.ts` | Better error messages |
