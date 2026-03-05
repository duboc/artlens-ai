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

ArtLens AI is a mobile-first, camera-based art identification app. Users point their phone at artwork (or upload an image), and the app uses Gemini Flash 2.5 to:

1. **Identify** the artwork (title, artist, year, country) via Google Search grounding
2. **Analyze** the visual style and generate bounding-box annotations on regions of interest
3. **Deep-analyze** (async) historical context, symbolism, and curiosities
4. **Chat** about the artwork via text or live audio (Gemini Live API with native audio)

---

## User Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   Language    │────▶│  Onboarding  │────▶│    Main Camera View  │
│   Selector    │     │  (Name +     │     │    (Live Viewfinder) │
│  (en/pt/es)  │     │   Persona)   │     │                      │
└──────────────┘     └──────────────┘     └──────────┬───────────┘
                                                      │
                                          ┌───────────┴──────────┐
                                          │  Tap Shutter / Upload │
                                          └───────────┬──────────┘
                                                      │
                                          ┌───────────▼──────────┐
                                          │  Parallel API Calls   │
                                          │  1. Search (identify) │
                                          │  2. Vision (style +   │
                                          │     annotations)      │
                                          └───────────┬──────────┘
                                                      │
                                          ┌───────────▼──────────┐
                                          │  Result Card          │
                                          │  + Annotation Dots    │
                                          │  + Deep Analysis      │
                                          │    (async background) │
                                          └───────────┬──────────┘
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    │                 │                 │
                              ┌─────▼─────┐   ┌──────▼──────┐  ┌──────▼──────┐
                              │ Annotation │   │ Chat with   │  │  History    │
                              │ Detail     │   │ Guide       │  │  Drawer     │
                              │ Card       │   │ (Text+Voice)│  │             │
                              └────────────┘   └─────────────┘  └─────────────┘
```

---

## Architecture Map

```
index.html          ← Entry point, Tailwind CDN, theme config
  └─ index.tsx      ← React root mount
       └─ App.tsx   ← State machine: Language → Onboarding → Main View

Components:
  ├─ LanguageSelector.tsx    ← Screen 1: pick en/pt/es
  ├─ OnboardingForm.tsx      ← Screen 2: name + persona (guide/curator/blogger)
  ├─ CameraFeed.tsx          ← Live camera stream + freeze frame
  ├─ HUDOverlay.tsx          ← Viewfinder reticle, shutter button, upload button
  ├─ AnalysisResultCard.tsx  ← Bottom sheet with art data, deep analysis, chat trigger
  ├─ ImageAnnotationLayer.tsx← Clickable dots over frozen image
  ├─ AnnotationCard.tsx      ← Bottom sheet for selected annotation detail
  ├─ ChatWindow.tsx          ← Text + voice chat with topic chips
  └─ HistoryDrawer.tsx       ← Side drawer with past scans

Hooks:
  ├─ useGeminiChat.ts        ← Text chat via Gemini SDK Chat API + localStorage persistence
  └─ useGeminiLive.ts        ← Real-time audio via Gemini Live API (bidirectional)

Services:
  └─ geminiService.ts        ← identifyArtwork() + getDeepArtworkAnalysis()

Utils:
  └─ audioUtils.ts           ← PCM encoding/decoding for live audio stream

Types:
  └─ types.ts                ← All shared interfaces
```

---

## File-by-File Guide

### Where to change the **AI behavior and instructions**

| What to change | File | Location |
|---|---|---|
| **Artwork identification prompt** (what fields are returned, how search works) | `services/geminiService.ts` | Lines 88-109 (`searchPrompt`) |
| **Visual analysis prompt** (style, description, annotation regions) | `services/geminiService.ts` | Lines 114-138 (`visualPrompt`) |
| **Deep analysis prompt** (historicalContext, symbolism, curiosities) | `services/geminiService.ts` | Lines 207-215 |
| **Gemini model ID** for text calls | `services/geminiService.ts` | Line 6 (`gemini-2.5-flash`) |
| **Chat system instruction** (text chat personality) | `hooks/useGeminiChat.ts` | Line 49 |
| **Voice system instruction** (live audio personality, persona switching) | `hooks/useGeminiLive.ts` | Lines 131-171 (`systemInstruction`) |
| **Voice model ID** | `hooks/useGeminiLive.ts` | Line 125 |
| **Voice configuration** (voice name, modalities) | `hooks/useGeminiLive.ts` | Lines 176-182 |
| **Deep analysis context injection** during live session | `components/ChatWindow.tsx` | Lines 57-64 |

### Where to change the **UI and layout**

| What to change | File | Location |
|---|---|---|
| **Global theme colors** (surface, primary, secondary, accent) | `index.html` | Lines 16-33 (Tailwind config) |
| **Global fonts** | `index.html` | Line 13 |
| **Animations** (fade-in, slide-up, pulse) | `index.html` | Lines 39-53 |
| **Language selector screen** | `components/LanguageSelector.tsx` | Entire file |
| **Onboarding screen** (name input, persona cards) | `components/OnboardingForm.tsx` | Entire file |
| **Camera viewfinder** (reticle, scanning animation) | `components/HUDOverlay.tsx` | Lines 62-84 |
| **Shutter button** design | `components/HUDOverlay.tsx` | Lines 108-122 |
| **Result card** (title, tags, description, fun fact, deep analysis) | `components/AnalysisResultCard.tsx` | Lines 111-216 |
| **Result card minimized pill** | `components/AnalysisResultCard.tsx` | Lines 51-79 |
| **Annotation dots** over image | `components/ImageAnnotationLayer.tsx` | Lines 31-71 |
| **Annotation detail card** | `components/AnnotationCard.tsx` | Entire file |
| **Chat window** (messages, topic chips, input bar) | `components/ChatWindow.tsx` | Lines 112-281 |
| **History drawer** | `components/HistoryDrawer.tsx` | Entire file |

### Where to change the **data model**

| What to change | File |
|---|---|
| Add new fields to art data | `types.ts` — `ArtData` interface (line 21) |
| Add new fields to deep analysis | `types.ts` — `DeepArtData` interface (line 7) |
| Add new annotation fields | `types.ts` — `Annotation` interface (line 14) |
| Add new languages | `types.ts` — `Language` type (line 44), plus i18n strings in `OnboardingForm.tsx` and `geminiService.ts` |
| Add new personas | `types.ts` — `Persona` type (line 54), plus persona instructions in `useGeminiLive.ts` |

---

## AI Prompts & Instructions

### Current Prompt Architecture

The app uses **3 separate Gemini calls** for analysis, plus **2 modes** for conversation:

#### 1. Identification (Google Search grounded)
- **File:** `services/geminiService.ts:88-109`
- **Model:** `gemini-2.5-flash` with `tools: [{ googleSearch: {} }]`
- **Returns:** title, artist, year, country, funFact
- **Limitation:** Cannot use `responseMimeType: 'application/json'` because of the search tool — relies on prompt engineering + `parseJSON()` helper

#### 2. Visual Analysis (structured JSON)
- **File:** `services/geminiService.ts:114-138`
- **Model:** `gemini-2.5-flash` with `responseMimeType: 'application/json'`
- **Returns:** style, description, annotations (with bounding boxes)
- **Runs in parallel** with identification

#### 3. Deep Analysis (async, background)
- **File:** `services/geminiService.ts:204-245`
- **Triggered immediately** after initial results come back
- **Returns:** historicalContext, technicalAnalysis, symbolism, curiosities[]

#### 4. Text Chat
- **File:** `hooks/useGeminiChat.ts`
- **System instruction:** "You are an expert art historian. User is looking at: {title} by {artist}. Respond in {language}."
- **Persists** chat history to localStorage per artwork+language

#### 5. Live Audio Chat
- **File:** `hooks/useGeminiLive.ts`
- **Model:** `gemini-2.5-flash-native-audio-preview-12-2025`
- **Voice:** `Kore`
- **Full persona-aware system instruction** including deep analysis context if available
- **Supports:** bidirectional audio, transcription, mute/unmute, text input over voice session

### Improvement Opportunities for Prompts

| Area | Current State | Suggested Improvement |
|---|---|---|
| **Identification accuracy** | Single prompt, relies on Google Search | Add a verification step or confidence score. Ask the model to state confidence level. |
| **Annotation quality** | "Identify 4-5 distinct regions" — generic | Make annotations artwork-type-aware (painting vs sculpture vs installation). Tune prompt for compositional elements (foreground/background, focal point, color regions). |
| **Fun fact depth** | Single sentence | Request 2-3 graded facts (beginner, intermediate, expert) tied to the persona. |
| **Language consistency** | Instructions say "Respond in X" | Some users report mixed-language responses. Add stronger constraints: "You MUST respond entirely in {language}. Do not use any other language." |
| **Persona differentiation** | Only applied in voice chat | Apply persona to ALL prompts (identification, visual, deep analysis, text chat) for a consistent tone throughout. |
| **Deep analysis prompt** | Generic "act as art historian" | Add prompt sections for: materials/medium, provenance, cultural impact, comparison to similar works. |
| **Chat system instruction** | Minimal — just title + artist | Include all available data (style, description, annotations, deep analysis) so chat has full context from the start. |

---

## Mood & Personality

### Current Persona System

Defined in `types.ts:54` as `'guide' | 'academic' | 'blogger'`.

Only applied in **voice chat** (`useGeminiLive.ts:132-143`):

| Persona | Current Instruction |
|---|---|
| `guide` | "Warm, friendly Museum Guide. Accessible, encouraging, helpful. Simple metaphors." |
| `academic` | "Distinguished Art Historian. Formal language, techniques, historical parallels." |
| `blogger` | "Energetic Art Influencer. Exciting, accessible, slang, viral, cool. Fast-paced." |

### Where Persona is NOT Applied (Gaps)

- **Text chat** (`useGeminiChat.ts:49`) — uses a generic "expert art historian" regardless of persona
- **Identification prompt** (`geminiService.ts:88`) — no persona influence
- **Visual analysis** (`geminiService.ts:114`) — no persona influence
- **Deep analysis** (`geminiService.ts:207`) — no persona influence
- **Fun fact** — same tone regardless of persona
- **UI text/labels** — static, not persona-aware

### Improvement Opportunities for Mood

| Area | Suggestion |
|---|---|
| **Unified persona** | Pass persona to `geminiService.ts` calls so fun facts, descriptions, and deep analysis match the chosen tone. |
| **Persona in text chat** | Update `useGeminiChat.ts:49` to use the same persona instructions as voice. |
| **UI tone** | Adjust UI copy based on persona (e.g., "Yo, check this out!" for blogger vs "Observe the following" for academic). |
| **New personas** | Consider adding: `kids` (age 6-12, simple words, playful), `artist` (focus on technique, materials, how-to-recreate), `philosopher` (existential themes, meaning of art). |
| **Voice selection** | Different Gemini voice per persona (currently hardcoded to `Kore`). |
| **Greeting** | After onboarding, have the AI greet the user by name in their chosen persona before first scan. |

---

## UI Improvement Opportunities

### Onboarding Flow

| Issue | File:Line | Suggestion |
|---|---|---|
| No back button from onboarding to language | `App.tsx:167-173` | Add a back button or swipe gesture to return to language selection. |
| Persona descriptions are vague | `OnboardingForm.tsx:18-23` | Add a short preview sentence in the persona's voice so users understand the difference. |
| No skip option | `OnboardingForm.tsx` | Allow "Skip" to use defaults (English, Guest, Guide). |
| No branding/splash | `LanguageSelector.tsx` | Consider a brief animated logo or tagline before language selection. |

### Camera & Scanning

| Issue | File:Line | Suggestion |
|---|---|---|
| No camera flip button | `CameraFeed.tsx:14` | Add front/back camera toggle (currently hardcoded to `environment`). |
| No zoom controls | `CameraFeed.tsx` | Pinch-to-zoom for detail shots of large artworks. |
| No flash/torch toggle | `CameraFeed.tsx` | Useful in dimly lit galleries. |
| Scanning animation is minimal | `HUDOverlay.tsx:78-83` | Add a more satisfying scan animation (e.g., a traveling line, particle effect, or border trace). |
| "Tap to identify" text not localized | `HUDOverlay.tsx:138-139` | Use i18n strings based on selected language. |
| Upload button hard to discover | `HUDOverlay.tsx:125-136` | Add a label or tooltip on first use. |

### Result Card

| Issue | File:Line | Suggestion |
|---|---|---|
| No share button | `AnalysisResultCard.tsx` | Add share functionality (Web Share API) for the result. |
| No save/bookmark | `AnalysisResultCard.tsx` | Let users "favorite" artworks separately from history. |
| Deep analysis loading has no ETA | `AnalysisResultCard.tsx:191-199` | Add a progress indicator or "This usually takes 5-10 seconds". |
| Sources section is cramped | `AnalysisResultCard.tsx:203-214` | Improve source display with favicons or a modal for full list. |
| "Chat with Guide" button label doesn't reflect persona | `AnalysisResultCard.tsx:145` | Change to "Chat with Curator" / "Chat with Blogger" based on selection. |
| No image comparison | `AnalysisResultCard.tsx` | Side-by-side with a reference image from the web (if sourced). |
| `technicalAnalysis` from deep data is never displayed | `AnalysisResultCard.tsx:166-190` | The `technicalAnalysis` field exists in `DeepArtData` but is not rendered anywhere. |

### Chat Window

| Issue | File:Line | Suggestion |
|---|---|---|
| No message copy/long-press | `ChatWindow.tsx:184-199` | Allow users to copy model responses. |
| No markdown rendering in chat | `ChatWindow.tsx:195` | Model responses may contain formatting — render markdown. |
| Topic chips don't update after conversation | `ChatWindow.tsx:214-241` | Make chips contextual — suggest follow-up topics based on what was discussed. |
| No conversation export | `ChatWindow.tsx` | Let users export chat as text/PDF. |
| Voice connection starts muted by default | `useGeminiLive.ts:22` | Consider auto-unmuting when the user initiates voice, with a clear indicator. |
| No "end voice session" button (only mute) | `ChatWindow.tsx:248-258` | Add an explicit disconnect button separate from mute. |

### History Drawer

| Issue | File:Line | Suggestion |
|---|---|---|
| History is in-memory only | `App.tsx:32` | Persist to localStorage or IndexedDB so history survives page refresh. |
| No delete/clear history | `HistoryDrawer.tsx` | Add swipe-to-delete or "Clear All" button. |
| No search/filter | `HistoryDrawer.tsx` | Add search by title/artist if history grows. |
| Thumbnails are full data URLs | `App.tsx:59-60` | Compress thumbnails for history to save memory. |

### General UI

| Issue | Suggestion |
|---|---|
| No dark/light theme toggle | The app is dark-only. Consider auto-detecting or offering a light mode for outdoor use. |
| No accessibility features | Add aria labels (partially done), screen reader support, high contrast mode. |
| No offline indicator | Show a banner when offline — the app requires network for all AI features. |
| No loading skeleton on initial camera start | Camera permission can take a moment — show a skeleton/placeholder. |
| Tailwind via CDN | Move to a proper Tailwind build for production (tree-shaking, smaller bundle). |

---

## Feature Improvement Opportunities

### High Impact

| Feature | Description | Files Affected |
|---|---|---|
| **Persistent history** | Save scan history to localStorage/IndexedDB | `App.tsx`, `HistoryDrawer.tsx` |
| **Multi-artwork comparison** | Compare two scanned artworks side-by-side | New component, `types.ts` |
| **Gallery/Museum mode** | Auto-detect museum via location, show relevant context | New service, `App.tsx` |
| **Offline art database** | Cache previously scanned artworks for offline viewing | New service, `types.ts` |
| **Social sharing** | Share analysis result as a card/story image | `AnalysisResultCard.tsx`, new util |

### Medium Impact

| Feature | Description | Files Affected |
|---|---|---|
| **Guided tour mode** | Walk through annotations in sequence with narration | `ImageAnnotationLayer.tsx`, `AnnotationCard.tsx`, `useGeminiLive.ts` |
| **Quiz mode** | Test knowledge after viewing artwork | New component, `useGeminiChat.ts` |
| **Artist portfolio** | After identifying, show other works by the same artist | `geminiService.ts`, new component |
| **AR overlay text** | Show annotation labels directly on the image in AR style | `ImageAnnotationLayer.tsx` |
| **Audio autoplay greeting** | After first scan, auto-greet the user via voice | `ChatWindow.tsx`, `useGeminiLive.ts` |

### Low Impact / Nice-to-have

| Feature | Description | Files Affected |
|---|---|---|
| **Theme customization** | Let users pick accent colors | `index.html`, new settings |
| **Font size control** | Accessibility improvement | `index.html` |
| **Haptic feedback** | Vibrate on scan completion (mobile) | `App.tsx` |
| **Sound effects** | Shutter sound, notification chime | `App.tsx`, `HUDOverlay.tsx` |
| **PWA support** | Add manifest + service worker for installability | New files |

---

## Technical Debt & Code Quality

| Issue | File | Suggestion |
|---|---|---|
| No error boundary | `App.tsx` | Wrap app in a React Error Boundary for graceful crash handling. |
| No tests | — | Add Vitest + React Testing Library. Priority: `geminiService.ts`, `useGeminiChat.ts`. |
| `console.log`/`console.error` throughout | Multiple files | Replace with a structured logger or remove for production. |
| `any` types scattered | `geminiService.ts:9`, `useGeminiLive.ts:41`, `OnboardingForm.tsx:124` | Replace with proper types. |
| Camera stream not cleaned on all paths | `CameraFeed.tsx:41-47` | The cleanup runs on unmount but not on re-mount when `frozenImage` changes. May leak streams. |
| `ScriptProcessorNode` is deprecated | `useGeminiLive.ts:34` | Migrate to `AudioWorkletNode` for better performance and future compatibility. |
| Tailwind CDN in production | `index.html:7` | Use `tailwindcss` as a dev dependency with PostCSS for tree-shaking. |
| No environment variable validation | `services/geminiService.ts:4` | Add startup check for `API_KEY` presence with a user-friendly error. |
| Import map remnants | `index.html` | Already removed, but verify no CDN dependencies remain. |
| `executeDeepAnalysis` not awaited (fire-and-forget) | `App.tsx:109` | Intentional but errors are silently swallowed. Consider surfacing deep analysis failures to user. |
| Chat re-creates SDK client on title/language change | `useGeminiChat.ts:31-52` | Could cause brief disconnection — consider debouncing. |
| No rate limiting on scan button | `HUDOverlay.tsx:108` | User can tap rapidly and trigger multiple API calls. Add debounce. |
