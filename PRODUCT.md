# PRODUCT.md — ArtLens AI

## Job
A museum companion on the visitor's own phone. Point the camera at an artwork → get an identification
(title, artist, year, style, story) grounded in Google Search, then go deeper by chat or voice with a
persona guide. Current event: **Museo Reina Sofía, Madrid** for the Google Cloud **AI Leadership
Academy** (event config in `museums/`; earlier MNAC edition remains in `museums/mnac.ts`).

**Operational pressure**: standing in a gallery, one hand, low light, patchy network, short attention
between rooms. Everything must be glanceable and survive a slow model response or a failed request.

## Mode
**Operate** — a camera instrument with a light game layer. Reading happens in the result sheet, but the
primary loop is scan → act → move on.

## Users
AI Leadership Academy attendees (executives) visiting the museum individually: no teams, no time limit,
an individual ranking. Languages: English, Español, Português.

## Core surfaces
1. **Welcome / language** (`LanguageSelector`) → **Onboarding** (`OnboardingForm`: name, email, optional selfie).
2. **Scan** (camera, `HUDOverlay`): full-bleed feed, reticle, shutter, upload, points pill.
3. **Result sheet** (`AnalysisResultCard`): identification, chat/voice (`ChatWindow`), quiz (`QuizPanel`),
   "Generate me", deep analysis, **How the AI thought** (`AiTracePanel`).
4. **Missions · Ranking · Profile** panels (`components/game/`), reached via `BottomNav`.
5. **AwardToast** after a scan earns points; History drawer and Gallery from Profile.

## Primary flows
- Scan an artwork → toast shows `+N` (new artwork / mission completed) → result sheet.
- From result: chat or talk with the guide; take the quiz for points; open "How the AI thought" to see
  model, latency, thinking level, confidence, Google searches and sources.
- Check Missions to plan the next room → glance at Ranking → back to Scan.

## Non-regression invariants
- Camera-first: Scan is the default tab; the feed stays full-bleed; portrait only.
- Chat/voice and quiz take over the sheet (immersive) and hide the tab bar; leaving restores it.
- Pinned visual world (see [DESIGN.md](DESIGN.md)): dark ground, Google blue as the only signal hue,
  Google Sans / Google Sans Text, JetBrains Mono for numbers only.
- Points are server-authoritative; UI never invents totals. Errors are inline with Retry, never blocking.
- Every interactive control ≥44px with a visible focus ring; no text below 12px; reduced motion honored.
- All copy goes through `utils/i18n` (`t` / `tf`) in EN / ES / PT.
