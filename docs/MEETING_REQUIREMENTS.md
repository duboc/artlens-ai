# Meeting Requirements — Google Cloud AI Leadership Academy

**Date:** 2026-02-26
**Project:** ArtLens AI for Google Cloud AI Leadership Academy
**Venue:** Museu Nacional d'Art de Catalunya (MNAC)
**Deadline:** March 6, 2026 (event: March 18, 2026)
**Next checkpoint:** Weekly sync (next week)

---

## Key Decisions

| # | Decision | Details |
|---|----------|---------|
| 1 | **Museum** | Museu Nacional d'Art de Catalunya (MNAC) — scope limited to this museum |
| 2 | **Project name** | "Google Cloud AI Leadership Academy" (no new external branding) |
| 3 | **Language** | English as the primary language (enables broader audience) |
| 4 | **Personas (3)** | Historian, Influencer, Classic Guide (replacing previous curator/blogger/guide) |
| 5 | **Color scheme** | Black + Google Blue |
| 6 | **Font** | Google Sans |

---

## Requirements & Asks

### P0 — Onboarding & User Identity

- [ ] **Email capture at onboarding** — Collect user email during onboarding for identification and future gallery access.
- [ ] **Selfie capture at onboarding** — Request a selfie from the user during onboarding. This photo is reused across all artwork image generation experiences.
- [ ] **Rename personas** — Update from current (guide / academic / blogger) to new names:
  - `guide` → **Classic Guide** (guia clássico)
  - `academic` → **Historian** (historiador)
  - `blogger` → **Influencer**

### P1 — Core Interaction Flow

- [ ] **Auto-start audio + chat after scan** — When user scans an artwork, immediately open the audio narration and chat box. No extra taps required to start the experience.
- [ ] **"Start conversation" button** — Provide a clear button that triggers the narrator to begin speaking about the artwork. Gives user control over when audio starts.
- [ ] **Stop narration button** — Allow user to interrupt/stop the audio narration at any time (important for long explanations).
- [ ] **Show artwork name + tags on initial screen** — Display the artwork title and relevant tags right on the main view, with chat summary below.
- [ ] **Exit to camera via "X"** — Simple close button to exit the current artwork conversation and return to camera for scanning the next piece.

### P2 — UI/UX & Theming

- [ ] **Google Sans font** — Replace current font with Google Sans throughout the app.
- [ ] **Black + Google Blue color palette** — Update theme colors to black background with Google Blue accents.
- [ ] **Interactive annotation dots on artwork** — Clickable hotspots overlaid on the artwork image so users can tap specific areas to get details (already partially implemented).

### P3 — Persona & Guide Customization

- [ ] **Option to switch persona mid-session** — Add a control within chat to go back and change the active guide/persona without restarting.
- [ ] **Explanation length toggle** — Let user choose between short and long explanations (or short/medium/long guide types).

### P4 — Image Generation & Gallery

- [ ] **"Nano banana" style image generation** — Button on each artwork that generates a personalized photo of the user in the art style of that piece, using the selfie captured at onboarding.
- [ ] **Virtual art gallery** — In-app gallery where users can view and download all their generated images (preferred over email delivery).

### Future — Not in Scope for March 6

- [ ] **Background soundtrack from the era** — Period-appropriate music loop behind narration (Lyria 3, 30s streams). Exploratory.
- [ ] **Microphone selection** — Let user choose input microphone (phone mic vs. earphone mic).
- [ ] **Reusable demo for other museums** — Architecture should allow adaptation but not a current deliverable.
- [ ] **History/revisit functionality** — Already exists via `HistoryDrawer`, keep as-is.

---

## Ownership & Next Steps

| Owner | Task |
|-------|------|
| Anderson Duboc | Change font to Google Sans |
| Anderson Duboc | Add option to switch persona and choose guide length (short/medium/long) |
| Anderson Duboc | Explore background soundtrack from artwork era (Lyria 3, 30s loops) |
| Rafael Groba | Schedule weekly checkpoint with Anderson Duboc |

---

## Brainstorm & Future Ideas

These ideas came up during discussion but are not committed for the March 6 deadline:

1. **Reusable demo for other museums** — The app is scoped to MNAC but the architecture should allow adaptation to other venues in the future.
2. **Sticker album project** — Anderson presented a separate project generating personalized startup stickers in a "Copa album" format (well received, separate scope).
3. **CBF partnership potential** — Discussion of a serious (non-playful) project with CBF (Brazilian Football Confederation).

---

## Mapping to Current Codebase

| Priority | Requirement | Relevant Files | Current State |
|----------|-------------|---------------|---------------|
| P0 | Email + selfie capture | `OnboardingForm.tsx` | Currently collects name + persona only. New flow: email → selfie → persona (3-step wizard) |
| P0 | Personas rename | `types.ts`, `OnboardingForm.tsx`, `useGeminiLive.ts` | Has guide/academic/blogger — needs rename |
| P1 | Auto-start audio+chat | `App.tsx` (state machine) | Currently requires user action to open chat |
| P1 | Start/stop narration | `ChatWindow.tsx`, `useGeminiLive.ts` | Needs explicit start/stop buttons |
| P1 | Artwork name on screen | `AnalysisResultCard.tsx` | Already shows info in bottom sheet |
| P2 | Font change | `index.html` (Tailwind config) | Currently uses default fonts |
| P2 | Color scheme | `index.html` (Tailwind theme) | Has custom theme — needs update to black+Google Blue |
| P2 | Annotation dots | `ImageAnnotationLayer.tsx` | Already implemented — verify completeness |
| P3 | Switch persona mid-session | `ChatWindow.tsx`, `App.tsx` | Not yet implemented |
| P3 | Explanation length toggle | `useGeminiLive.ts`, `useGeminiChat.ts` | Not yet implemented |
| P4 | Image generation | New service needed | Not yet implemented |
| P4 | Virtual gallery | New component needed | Not yet implemented |
| Future | Background music | New feature | Not yet implemented |
| Future | Mic selection | `useGeminiLive.ts`, `utils/audioUtils.ts` | Not yet implemented |
