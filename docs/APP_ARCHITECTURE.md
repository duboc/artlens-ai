# ArtLens AI — App Architecture & Improvement Map

## Table of Contents

1. [App Overview](#app-overview)
2. [User Flow](#user-flow)
3. [Architecture Map](#architecture-map)
4. [File-by-File Guide](#file-by-file-guide)
5. [AI Prompts & Instructions](#ai-prompts--instructions)
6. [Mood & Personality](#mood--personality)
7. [UI Improvement Opportunities](#ui-improvement-opportunities)
8. [Feature Improvement Opportunities](#feature-improvement-opportunities)
9. [Technical Debt & Code Quality](#technical-debt--code-quality)

---

## App Overview

ArtLens AI is a mobile-first, camera-based art identification app. Users point their phone at artwork (or upload an image), and the app uses Gemini via a backend proxy to:

1. **Identify** the artwork (title, artist, year, country) via Google Search grounding
2. **Analyze** the visual style and generate bounding-box annotations on regions of interest
3. **Deep-analyze** (async) historical context, symbolism, and curiosities
4. **Chat** about the artwork via text or live audio (Gemini Live API with native audio)
5. **Generate Portraits** in the style of the artwork based on the user's selfie

---

## User Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   Language   │────▶│  Onboarding  │────▶│    Main Camera View  │
│   Selector   │     │ (Name, Selfie│     │    (Live Viewfinder) │
│  (en/pt/es)  │     │   Persona)   │     │                      │
└──────────────┘     └──────────────┘     └──────────┬───────────┘
                                                     │
                                          ┌──────────┴───────────┐
                                          │  Tap Shutter / Upload│
                                          └──────────┬───────────┘
                                                     │
                                          ┌──────────▼───────────┐
                                          │  Parallel API Calls  │
                                          │  1. Search (identify)│
                                          │  2. Vision (style +  │
                                          │     annotations)     │
                                          └──────────┬───────────┘
                                                     │
                                          ┌──────────▼───────────┐
                                          │  Result Card         │
                                          │  + Annotation Dots   │
                                          │  + Deep Analysis     │
                                          └──────────┬───────────┘
                                                     │
               ┌─────────────────┬───────────────────┼─────────────────┐
               │                 │                   │                 │
         ┌─────▼─────┐   ┌──────▼──────┐     ┌──────▼──────┐   ┌──────▼──────┐
         │ Annotation│   │ Chat with   │     │  Generate   │   │  History/   │
         │ Detail    │   │ Guide       │     │  Portrait   │   │  Gallery    │
         │ Card      │   │ (Text+Voice)│     │  Modal      │   │  Drawer     │
         └───────────┘   └─────────────┘     └─────────────┘   └─────────────┘
```

---

## Architecture Map

```
index.html          ← Entry point, Tailwind CDN, theme config
  └─ index.tsx      ← React root mount
       └─ App.tsx   ← State machine: Language → Onboarding → Main View

Components:
  ├─ LanguageSelector.tsx    ← Screen 1: pick en/pt/es
  ├─ OnboardingForm.tsx      ← Screen 2: 3-step wizard (name, selfie, persona)
  ├─ CameraFeed.tsx          ← Live camera stream + freeze frame
  ├─ HUDOverlay.tsx          ← Viewfinder reticle, shutter, history & gallery buttons
  ├─ AnalysisResultCard.tsx  ← Bottom sheet with art data, deep analysis, actions
  ├─ ImageAnnotationLayer.tsx← Clickable dots over frozen image
  ├─ AnnotationCard.tsx      ← Bottom sheet for selected annotation detail
  ├─ ChatWindow.tsx          ← Text + voice chat with topic chips
  ├─ HistoryDrawer.tsx       ← Side drawer with past scans
  ├─ GenerateModal.tsx       ← Modal for Gemini-powered portrait generation
  └─ Gallery.tsx             ← Full-screen gallery of generated portraits

Hooks:
  ├─ useGeminiChat.ts        ← Text chat via POST /api/generate
  └─ useGeminiLive.ts        ← Real-time audio via WebSocket proxy

Services:
  ├─ apiClient.ts            ← HTTP fetch wrapper handling X-User-Id auth
  └─ geminiService.ts        ← identifyArtwork() + getDeepArtworkAnalysis()

Utils:
  ├─ audioUtils.ts           ← PCM encoding/decoding for live audio stream
  ├─ i18n.ts                 ← Translation strings for UI

Types:
  └─ types.ts                ← All shared interfaces

Backend (Express):
  ├─ routes/generate.ts      ← Proxies to Vertex AI /generateContent
  ├─ routes/images.ts        ← Cloud Storage uploads
  ├─ routes/users.ts         ← User profile CRUD via Firestore
  ├─ ws/live.ts              ← WebSocket bridge to Vertex AI BidiGenerateContent
```

---

## File-by-File Guide

### Where to change the **AI behavior and instructions**

| What to change | File | Location |
|---|---|---|
| **Artwork identification prompt** | `services/geminiService.ts` | `searchPrompt` string |
| **Visual analysis prompt** | `services/geminiService.ts` | `visualPrompt` string |
| **Deep analysis prompt** | `services/geminiService.ts` | `getDeepArtworkAnalysis` |
| **Gemini model ID (Text)** | `server/config.ts` | `config.vertex.modelText` |
| **Gemini model ID (Voice)** | `server/config.ts` | `config.vertex.modelLive` |
| **Chat system instruction** | `hooks/useGeminiChat.ts` | `systemInstructionRef` |
| **Voice system instruction** | `hooks/useGeminiLive.ts` | `systemInstruction` builder |

### Where to change the **UI and layout**

| What to change | File | Location |
|---|---|---|
| **Global theme colors** | `index.html` | Tailwind config (Black + Google Blue theme) |
| **Global fonts** | `index.html` | Google Sans & Google Sans Text |
| **Language selector screen** | `components/LanguageSelector.tsx` | Entire file |
| **Onboarding screen** | `components/OnboardingForm.tsx` | Entire file (wizard steps) |
| **Result card** | `components/AnalysisResultCard.tsx` | Card UI, "Generate Me" button |
| **Image Generation Modal** | `components/GenerateModal.tsx` | Generating state and result UI |
| **Generated Gallery** | `components/Gallery.tsx` | Grid and detail overlay |
| **Chat window** | `components/ChatWindow.tsx` | Text + voice UI |

---

## AI Prompts & Instructions

### Current Prompt Architecture

The app uses **backend-proxied calls** to Vertex AI for all generation.

#### 1. Identification (Google Search grounded)
- **File:** `services/geminiService.ts` -> `/api/generate`
- **Model:** text model with `tools: [{ googleSearchRetrieval: {} }]`
- **Returns:** title, artist, year, country, funFact

#### 2. Visual Analysis (structured JSON)
- **File:** `services/geminiService.ts` -> `/api/generate`
- **Model:** text model with `responseMimeType: 'application/json'`
- **Returns:** style, description, annotations (with bounding boxes)

#### 3. Deep Analysis (async, background)
- **File:** `services/geminiService.ts` -> `/api/generate`
- **Triggered immediately** after initial results come back

#### 4. Text Chat
- **File:** `hooks/useGeminiChat.ts` -> `/api/generate`
- **System instruction:** Expert art historian + contextual prompt + length instruction
- **Persists** chat history to localStorage

#### 5. Live Audio Chat
- **File:** `hooks/useGeminiLive.ts` -> WebSocket `/ws/live`
- **Full persona-aware system instruction** including deep analysis context

#### 6. Image Generation
- **File:** `server/routes/generateImage.ts` (or similar)
- **Model:** Imagen or Gemini 2.0 Flash experimental via Vertex AI
- Uses the user's selfie and the artwork's title/style as the prompt.

---

## Mood & Personality

### Current Persona System

Defined in `types.ts:54` as `'guide' | 'academic' | 'blogger'` (Classic Guide, Historian, Influencer).

| Persona | Internal | Voice Instruction Tone |
|---|---|---|
| Classic Guide | `guide` | Warm, friendly Museum Guide. Accessible, encouraging, helpful. |
| Historian | `academic` | Distinguished Art Historian. Formal language, techniques. |
| Influencer | `blogger` | Energetic Art Influencer. Exciting, accessible, slang, viral, cool. |

### Where Persona is Applied
- **Voice chat:** Uses specific personality instructions for Kore voice.
- **Text chat:** Shared prompt logic in `useGeminiChat.ts`.
- **UI:** The Chat window header adapts to show the active persona.

### Improvement Opportunities for Mood
- **Identification/Deep Analysis:** The initial scan results are still generic. Passing the persona to `geminiService.ts` could ensure the fun facts and deep analysis match the selected tone immediately.

---

## UI Improvement Opportunities

### Camera & Scanning
- **Camera flip:** Provide a toggle between front/back camera in `CameraFeed.tsx`.
- **Zoom controls:** Pinch-to-zoom for detail shots of large artworks.

### Result Card
- **Share button:** Add Web Share API functionality for the analysis result.
- **Save/bookmark:** Let users "favorite" artworks.

### General UI
- **PWA support:** Add manifest + service worker for offline capabilities and installability.

---

## Feature Improvement Opportunities

### High Impact
- **Gallery/Museum mode:** Auto-detect museum via location, show relevant context.
- **Offline art database:** Cache previously scanned artworks for offline viewing.
- **Multi-artwork comparison:** Compare two scanned artworks side-by-side.

### Medium Impact
- **Guided tour mode:** Walk through annotations in sequence with narration.
- **Quiz mode:** Test knowledge after viewing artwork.
- **Artist portfolio:** Show other works by the same artist.

---

## Technical Debt & Code Quality
- **No error boundary:** Wrap app in a React Error Boundary for graceful crash handling.
- **No tests:** Add Vitest + React Testing Library. Priority: `services/apiClient.ts`, `hooks/useGeminiChat.ts`.
- **Environment variables:** Better frontend validation during dev build if necessary.
- **Error swallowing:** `executeDeepAnalysis` is fire-and-forget in `App.tsx`; failures should be handled or logged more visibly.
