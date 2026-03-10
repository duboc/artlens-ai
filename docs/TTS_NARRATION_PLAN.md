# TTS Narration Plan

## Overview

When a user scans an artwork, generate a personalized narration script using **Flash Lite** (text generation), then synthesize it to audio using **Gemini 2.5 Flash TTS** (speech synthesis). Two-stage pipeline: text first for maximum persona control, then voice.

## Current Flow

1. User scans artwork → `identifyArtwork()` returns title, artist, year, style, description, funFact
2. Result card appears with artwork info
3. User manually clicks "Chat with Guide" to start voice conversation via Live API

## Proposed Flow

1. User scans artwork → `identifyArtwork()` returns result
2. **NEW Stage 1:** Flash Lite generates a narration script tailored to persona, language, user name, and art data
3. **NEW Stage 2:** Flash TTS synthesizes the script into audio with a persona-matched voice
4. Frontend plays the narration automatically (audio pre-warmed on scan tap)
5. Narration ends with an invitation to continue chatting
6. User clicks "Chat with Guide" → Live API session starts with **full context** of the narration script, so the voice agent continues naturally

## Architecture

### Two-Stage Pipeline

```
┌─────────────────────┐     ┌──────────────────────┐     ┌────────────┐
│  Art Data + Persona  │────▶│  Flash Lite (text)    │────▶│  Narration │
│  + Language + Name   │     │  gemini-3.1-flash-    │     │  Script    │
│                      │     │  lite-preview         │     │  (string)  │
└─────────────────────┘     └──────────────────────┘     └─────┬──────┘
                                                               │
                                                               ▼
                                                         ┌──────────────────┐     ┌───────────┐
                                                         │  Flash TTS        │────▶│  Audio    │
                                                         │  gemini-2.5-      │     │  (WAV)    │
                                                         │  flash-tts        │     │           │
                                                         └──────────────────┘     └───────────┘
```

**Why two stages instead of one?**
- Flash TTS is a speech synthesis model — it reads text aloud but doesn't "think" or personalize
- Flash Lite is where persona voice, cultural references, humor, user name, and art-specific details get crafted
- Separating them gives full control over what is said (Flash Lite) vs. how it sounds (Flash TTS)
- The generated script is reusable: displayed as text, passed as context to Live API, cached

### New Backend Endpoint

```
POST /api/tts/narrate
```

**Request:**
```json
{
  "artData": { "title", "artist", "year", "style", "description", "funFact" },
  "persona": "guide" | "academic" | "blogger",
  "language": "en" | "pt" | "es",
  "userName": "Carlos"
}
```

**Response:**
```json
{
  "script": "Hey Carlos! You're looking at...",
  "audioUrl": "/api/tts/narrate/audio/{narrationId}"
}
```

Or alternatively, return the audio as a binary stream with the script in a response header.

**Implementation:**

1. **Stage 1 — Script Generation (Flash Lite)**
   - `POST /api/generate` (reuse existing endpoint) or internal call to Vertex AI
   - Model: `gemini-3.1-flash-lite-preview` (fast, cheap)
   - Prompt includes: persona description, language, user name, full art data, fun fact
   - Output: plain text narration script, 2-3 sentences, ~15-20 seconds when spoken
   - No markdown, no formatting — pure spoken-word text

2. **Stage 2 — Speech Synthesis (Flash TTS)**
   - Model: `gemini-2.5-flash-tts` via Vertex AI with ADC
   - Input: the script from Stage 1, prefixed with a read-aloud instruction
   - Voice: mapped per persona (see Voice Mapping)
   - Output: streaming PCM chunks → concatenated into WAV
   - Region: `us-central1`

### Frontend Changes

**In `App.tsx` / `processImageAnalysis`:**
1. After `identifyArtwork()` succeeds, fire `POST /api/tts/narrate` (parallel with deep analysis)
2. Store returned `script` in state (`narrationScript`)
3. When audio arrives, play via pre-warmed `AudioContext`
4. Show audio indicator on result card (speaker icon with animation)

**In `ChatWindow` / `useGeminiLive`:**
- Inject narration script into system instruction so the Live API agent knows what was already said

### Audio Playback

- Pre-warm `AudioContext` on scan button click (same pattern as current voice chat)
- Stream or decode WAV → PCM buffer → `AudioBufferSourceNode`
- User can tap to stop narration early
- Opening chat while narration plays → stop narration, transition to live voice

## Prompt Design

### Stage 1: Script Generation Prompt

**System instruction:**
```
You are a museum audio guide at MNAC (Museu Nacional d'Art de Catalunya).

Personality: {persona_description}

Write a short narration script (2-3 sentences, about 30-45 seconds when read aloud) for a visitor who just scanned an artwork. The script must:
1. Greet the visitor by their first name
2. Identify the artwork naturally (title, artist, year)
3. Share one compelling detail — a story, hidden meaning, technique, or surprising fact
4. End with a warm invitation to continue the conversation

Rules:
- Write entirely in {language_name}
- Write as natural spoken text — no markdown, bullets, or formatting
- Match the personality exactly
- Use the fun fact or description provided if compelling, or craft your own insight
- Keep it conversational and engaging — this will be read aloud
```

**User message:**
```
Visitor name: {userName}

Artwork:
- Title: {title}
- Artist: {artist}
- Year: {year}
- Style: {style}
- Description: {description}
- Fun fact: {funFact}

Generate the narration script.
```

### Persona Descriptions (for prompt injection)

- **guide (Classic Guide):** You are warm, friendly, and approachable — like a knowledgeable friend showing someone around. You use conversational language, relatable comparisons, and genuine enthusiasm. You make everyone feel welcome regardless of their art knowledge.

- **academic (Historian):** You are scholarly, precise, and authoritative — a respected art historian sharing expertise. You provide historical context and use proper art terminology, but you remain engaging and never condescending. You connect the artwork to broader movements and cultural significance.

- **blogger (Influencer):** You are energetic, casual, and entertaining — you make art feel exciting and relevant. You use contemporary language, pop culture references, and dramatic storytelling. You focus on the "wow factor" and what makes this artwork share-worthy.

### Stage 2: TTS Read-Aloud Prompt

```
Read the following text aloud in a {tone} tone:

{script}
```

Where `tone` maps to:
- guide → "warm and friendly"
- academic → "measured and authoritative"
- blogger → "energetic and enthusiastic"

### Voice Mapping

| Persona    | Voice   | Tone                      |
|------------|---------|---------------------------|
| guide      | Zephyr  | Warm, friendly            |
| academic   | Kore    | Measured, authoritative   |
| blogger    | Puck    | Energetic, enthusiastic   |

### Example Outputs

**Guide (English):**
> "Hey Carlos! This is 'The Battle of Tetuan' by Marià Fortuny — believe it or not, he was only 24 and actually traveled to Morocco to sketch the battlefield firsthand. Tap to chat if you want to hear more!"

**Historian (Portuguese):**
> "Carlos, esta é 'A Batalha de Tetuan' de Marià Fortuny, 1863. Fortuny recebeu uma bolsa da Diputació de Barcelona aos 24 anos para documentar a campanha no Marrocos, e o resultado é esta composição monumental. Toque para continuarmos."

**Influencer (Spanish):**
> "¡Carlos! Estás frente a 'La Batalla de Tetuán' de Fortuny — el chico tenía solo 24 años y se fue hasta Marruecos a dibujar la batalla en persona. ¡Dale toque para más secretos!"

## Context Handoff to Live API

When the user opens the chat after hearing the narration:

1. `narrationScript` is stored in React state
2. Passed to `useGeminiLive` → injected into the system instruction
3. The Live API agent knows what was already said and continues naturally

```
System instruction addition:
"You already introduced yourself and the artwork to the visitor with this narration:
'{narrationScript}'
Continue the conversation naturally from here. Do not repeat the greeting or artwork identification. The visitor may ask follow-up questions about what you mentioned, or want to explore new aspects of the artwork."
```

## Technical Considerations

- **Latency budget:** Stage 1 (Flash Lite text) ~1-2s + Stage 2 (TTS) ~2-3s = ~3-5s total. Fast enough to start playing while user reads the result card.
- **Parallel execution:** Script generation runs parallel with deep analysis. TTS starts as soon as script is ready.
- **Streaming playback:** Play TTS audio chunks as they arrive — don't wait for the full WAV.
- **Caching:** Cache generated scripts per artwork+persona+language to skip Stage 1 on repeat visits. Audio can be regenerated cheaply.
- **Size:** ~20 seconds of 24kHz 16-bit mono PCM ≈ 960KB. Fine for mobile.
- **Fallback:** If either stage fails, silently skip narration — result card still works without it.
- **Stop control:** User can mute/stop narration. Opening chat stops narration and transitions to live voice.
- **Script display:** Optionally show the script as text in the result card (like subtitles) for accessibility.

## Server Config Additions

```typescript
// server/config.ts
modelTts: process.env.MODEL_TTS || 'gemini-2.5-flash-tts',
regionTts: process.env.VERTEX_REGION_TTS || 'us-central1',
```

## Implementation Order

1. Add TTS model config to `server/config.ts`
2. Create `server/routes/tts.ts` with `POST /api/tts/narrate`:
   - Stage 1: Call Flash Lite to generate script
   - Stage 2: Call Flash TTS to synthesize audio
   - Return script + stream audio
3. Add `useNarration` hook on frontend:
   - Calls `/api/tts/narrate` after scan
   - Manages AudioContext and playback state
   - Exposes: `isPlaying`, `script`, `stop()`
4. Wire into `App.tsx` scan flow (parallel with deep analysis)
5. Add narration indicator UI to result card (speaker icon, stop button)
6. Pass `narrationScript` to Live API system instruction in `useGeminiLive`
7. Test all 3 personas × 3 languages = 9 combinations
8. Tune prompts based on output quality
