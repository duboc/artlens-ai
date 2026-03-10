# TTS Narration Implementation Plan

- [x] 1. Add TTS model/region config to `server/config.ts` and streaming URL helper to `server/services/vertexai.ts`
- [x] 2. Create `server/routes/tts.ts` — Stage 1 (Flash Lite script gen) + Stage 2 (Flash TTS audio), returns `{ script, audio }` (base64 WAV)
- [x] 3. Mount route in `server/index.ts` at `/api/tts` with auth
- [x] 4. Create `hooks/useNarration.ts` — calls `/api/tts/narrate`, manages AudioContext playback, exposes `isPlaying`, `script`, `stop()`
- [x] 5. Wire into `App.tsx` — trigger narration after scan (parallel with deep analysis), pass script to result card
- [x] 6. Add narration UI to `AnalysisResultCard` — speaker icon with playing indicator, stop button
- [x] 7. Pass `narrationScript` to `useGeminiLive` system instruction so Live API doesn't repeat the intro
- [ ] 8. Test end-to-end
