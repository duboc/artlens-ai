# ArtLens AI — UI & User Flow Improvements

This document walks through the app as a real user would — standing in a museum, phone in hand — and identifies every friction point, dead end, and missed opportunity along the way.

---

## 1. First Launch: Language Selection

**Current:** Full-screen dark page. "ArtLens" title, "AI Museum Curator" subtitle, three language buttons.

### Problems

**No way back.** Tapping a language immediately advances to onboarding. If a user accidentally taps the wrong one, they have to reload the app. There's no language state persistence either — every page refresh restarts the entire flow.

**No visual identity.** The screen is functionally fine but visually cold. The user's first impression is a flat dark page with three buttons. For an app about *art*, this is a missed opportunity for delight.

**"Powered by Gemini Flash 2.5"** at the bottom is developer-facing text that means nothing to museum visitors.

### Suggested Improvements

- **Persist language to `localStorage`** so returning users skip this screen entirely
- **Add a back button** from onboarding to language, and from camera to onboarding (or a settings gear that lets you change both)
- Replace the "Powered by" footer with something user-facing like "Point your camera at any artwork"
- Consider **auto-detecting browser language** (`navigator.language`) and pre-selecting, showing the selector only as a fallback
- Add a subtle background — a blurred art detail, a slow gradient animation, or a particle field — to set the mood before the camera opens

**File:** `components/LanguageSelector.tsx`, `App.tsx:167-168`

---

## 2. Onboarding: Name & Persona

**Current:** Asks user's name (text input) and lets them pick a persona (Guide/Curator/Blogger) with cards. A "Start Exploring" button advances to the camera.

### Problems

**Persona descriptions are too vague.** "Friendly & accessible" vs "Deep & scholarly" doesn't tell the user what will actually change. They don't know if this affects the voice, the text, the depth of information, or just the tone. And in reality, it only affects voice chat — not the rest of the app.

**No preview of what each persona sounds like.** The user is making a blind choice that they can never change without reloading the app.

**No skip option.** Museum visitors in a hurry must still type their name before they can scan anything. This adds 10-15 seconds of friction before the core feature.

**The name placeholder says "Name" in English regardless of the selected language.**

### Suggested Improvements

- **Add a sample response** for each persona — show a short preview quote in the persona's voice (e.g., *"Fun fact: Van Gogh never sold this painting!"* for the Blogger vs *"This work exemplifies the post-impressionist departure from naturalistic color..."* for the Curator)
- **Add a "Skip" or "Guest" option** that defaults to "Visitor" + Guide persona. Let users who just want to scan artwork get there faster
- **Make persona changeable later** — add a settings icon to the HUD that reopens persona selection
- Localize the input placeholder to match the selected language
- **Persist user context to `localStorage`** — returning users shouldn't re-enter their name

**File:** `components/OnboardingForm.tsx`, `App.tsx:172-173`

---

## 3. Camera View: The Core Screen

**Current:** Full-screen live camera feed with a viewfinder reticle (corner brackets + center dot), a shutter button at the bottom center, an upload button to the right, a history button top-left, and an "ArtLens" badge top-center.

### Problems

**No camera controls.** The camera is locked to the rear-facing lens (`facingMode: 'environment'`). No flip button, no zoom, no torch/flashlight. In a dimly lit gallery, users can't improve the capture quality.

**No guidance for framing.** The reticle is 256x256px fixed — it doesn't help the user frame a painting that might be large and landscape-oriented. There's no feedback about whether the artwork is well-framed or if the image quality is good enough.

**The upload button is cryptic.** It's a small icon (image landscape) with no label. New users may not realize they can upload photos. On first use, a tooltip or label would help.

**"Tap to identify" is not localized.** It's always English regardless of language selection. Same for "Analyzing...".

**No scan debounce.** Rapid tapping the shutter button triggers multiple parallel API calls because the `isAnalyzing` guard only blocks after the first `setState`, which is async.

**The history button disappears when a result is showing.** If a user wants to compare the current result with a previous scan, they can't access history without first closing the result.

**No visual feedback on capture.** When the shutter fires, the frame freezes silently. Compare this to camera apps that show a brief white flash, a shutter animation, or a satisfying visual confirmation.

### Suggested Improvements

- **Add a camera flip button** (front/back toggle) — position it to the left of the shutter, mirroring the upload button
- **Add a torch/flashlight toggle** — small icon in the top bar area, especially for museums with low ambient light
- **Add pinch-to-zoom** — useful for distant or large-format artworks
- **Localize all HUD text** — "Tap to identify", "Analyzing...", and any other UI strings should use the `language` state
- **Add capture feedback** — a brief scale-down + white overlay flash on the camera feed when the shutter fires
- Add an **upload label on first use** — show "Upload photo" text below the icon for the first 3 uses, then hide it
- **Debounce the shutter button** — disable it immediately on click (before the async state update lands)
- **Keep the history button accessible** when results are showing — move it to the result card header or make it a persistent top-bar element

**Files:** `components/CameraFeed.tsx`, `components/HUDOverlay.tsx`, `App.tsx:120-130`

---

## 4. Scanning & Loading State

**Current:** When the user taps the shutter: the reticle is replaced by a pulsing rounded rectangle, the camera freezes on the captured frame, and "Analyzing..." appears.

### Problems

**The loading state is too minimal.** The scanning animation (a pulsing border + a blurred line) doesn't communicate what's happening. Users stare at their frozen photo with a subtle animation for 3-8 seconds with no progress indication.

**No cancel option.** Once a scan starts, the user can't abort it. If they captured the wrong thing, they have to wait for the full analysis to complete, close the result, and try again.

**No feedback separation between the two parallel calls.** The identification + visual analysis run in parallel, but the user sees nothing until both complete. Showing partial results (e.g., title + artist as soon as the search call returns, before the visual analysis finishes) would make it feel faster.

### Suggested Improvements

- **Progressive disclosure:** Show the title/artist as soon as the identification call returns, even if annotations aren't ready yet. This gives users something to read 2-3 seconds earlier
- **Add a cancel button** during scanning — "X" or "Cancel" that aborts the API calls and unfreezes the camera
- **Replace the pulsing animation** with something more engaging — a scanning line that sweeps across the image, or animated corner brackets that converge toward the center
- **Show a text progression:** "Identifying artwork..." → "Analyzing composition..." → "Uncovering details..." as the parallel calls progress
- Consider a **skeleton result card** that slides up immediately and fills in as data arrives, rather than showing nothing until everything is ready

**Files:** `components/HUDOverlay.tsx:78-83`, `App.tsx:91-118`

---

## 5. Result Card: Art Information

**Current:** A bottom sheet slides up with the artwork title, artist, year, country/style badges, a "Chat with Guide" button, description, fun fact, and (after async loading) deep analysis sections. The card can be minimized to a floating pill or closed entirely.

### Problems

**The "Chat with Guide" button label doesn't match the persona.** If the user chose "Curator", it still says "Chat with Guide." This breaks the persona illusion.

**`technicalAnalysis` is fetched but never displayed.** The `DeepArtData` type includes `technicalAnalysis` and it's returned from the API, but the result card only renders `historicalContext`, `symbolism`, and `curiosities`. This is wasted data.

**The deep analysis loading skeleton gives no time estimate.** "Uncovering hidden details..." is nice, but users don't know if it will take 2 seconds or 30 seconds.

**No share button.** Users who discover interesting art facts have no way to share the result — not as text, not as an image card, not as a link.

**The minimized pill is hard to re-expand.** Clicking the drag handle minimizes the card, but the pill's expand button is small (w-10 h-10) and close together with the close button. On a phone in a museum, this is easy to mis-tap.

**Sources are cramped and truncated.** Three sources max, truncated to 150px, in 10px text at the very bottom. They're almost invisible.

**No "scan another" button from the result view.** To scan a new artwork, the user must close the result (X button), which resets everything back to the camera. There's no shortcut like a small scan icon in the result card header.

### Suggested Improvements

- **Dynamic button label:** Change "Chat with Guide" to match persona — "Chat with Curator" / "Chat with Blogger" / "Talk to your Guide"
- **Display `technicalAnalysis`** — add a "Technique" section alongside Historical Context and Symbolism
- **Add a share action** — use the Web Share API (`navigator.share`) with a composed message: title, artist, fun fact, and a link if sources exist. Add a share icon to the card header
- **Add a "Scan Another" button** — either in the card header area (next to the close X) or as a floating action button that overlays the frozen image
- **Increase the minimized pill's expand target** — make the entire pill text area tappable for expand, and give the close button more visual separation (different color, or move it outside the pill)
- **Improve sources display** — show them as chips with a truncated domain name instead of full URLs. Link to a full sources modal if more than 3 exist
- **Add a loading ETA** — "Deep analysis usually takes 5-10 seconds" or a simple progress ring

**Files:** `components/AnalysisResultCard.tsx`, `types.ts:7-12`

---

## 6. Annotations: The AR Layer

**Current:** After scanning, clickable dots appear over the frozen image at positions determined by Gemini's bounding box output. Tapping a dot opens the AnnotationCard at the bottom, replacing the result card.

### Problems

**Annotations disappear when chat is open.** The `ImageAnnotationLayer` is hidden when `forceChatOpen` is true (`App.tsx:186`). This means the user can't reference visual regions while chatting about them.

**Dot labels are hover-only.** On mobile (the primary platform), hover states don't exist. Users must tap each dot blindly to discover what it labels. The labels only appear on desktop hover.

**Annotation dots don't show labels on mobile.** The tooltip relies on `group-hover:opacity-100` which does nothing on touch devices. Users see identical-looking dots and have to tap each one.

**No visual connection between dot and card.** When a user taps a dot, the AnnotationCard slides up at the bottom but there's no visual line or highlight connecting the dot to its region on the image. The user has to remember which dot they tapped.

**Closing an annotation goes back to result card.** There's no way to cycle through annotations sequentially — the user must close the card, find the next dot, and tap it.

### Suggested Improvements

- **Always-visible labels on mobile** — show short labels (2-3 words) next to each dot, not behind a hover state. Use a compact chip-style label
- **Add prev/next navigation to the AnnotationCard** — arrow buttons or swipe gesture to cycle through annotations without going back to the image
- **Draw a highlight box** on the image when an annotation is active — use the bounding box coordinates to draw a semi-transparent colored rectangle or an animated border around the region
- **Keep annotations visible during chat** — or at least show a small "View on image" button in chat when discussing a region
- **Number the dots** — show 1, 2, 3... inside each dot so users can reference them ("dot 3 is the sky")

**Files:** `components/ImageAnnotationLayer.tsx`, `components/AnnotationCard.tsx`, `App.tsx:186-192`

---

## 7. Chat Window: Text & Voice Conversation

**Current:** Full-height panel inside the result card. Shows message bubbles, topic chips at the bottom, text input, and mute toggle when voice is connected. Topic chips auto-connect to voice when tapped.

### Problems

**The chat empty state says "Select a topic to start voice chat" but the text input also works.** The messaging is confusing — it implies the user must use voice, when they can also just type a question.

**Topic chips silently start a voice session.** Tapping "About the Artist" immediately triggers `connect()` on the Live API, starts a microphone stream, and opens an audio session — without asking the user. In a quiet museum, this could be embarrassing.

**No explicit voice start/stop.** Voice connection happens automatically via topic chips. There's a mute button but no disconnect button. The user can mute their mic but the session stays open and the model keeps listening.

**The voice indicator is easy to miss.** A small green dot next to the username shows that voice is active, but it's 8px wide and buried in the header. Users may not realize they're in a live audio session.

**No way to switch between text and voice explicitly.** The two modes are merged in the same chat window but have different behaviors. Text messages go through `useGeminiChat`, voice goes through `useGeminiLive`, and transcriptions from voice are injected into the text chat via `addExternalMessage`. But there's no UI that communicates this dual-mode nature.

**No markdown rendering in messages.** The model often returns responses with formatting (bold, lists, headers) but they're rendered as plain text.

**"Tell me about the ..."** is prepended to all topic chip queries. This creates awkward messages like "Tell me about the Artist Monet" or "Tell me about the Historical context of Starry Night."

### Suggested Improvements

- **Separate voice and text modes clearly.** Add a prominent "Start Voice Chat" button (microphone icon) distinct from the text input. Show a clear "Voice Active" banner when connected
- **Ask before starting voice.** When a user taps a topic chip, send it as a text message first. Offer a separate, explicit "Switch to voice" action
- **Add a disconnect button** — when voice is connected, show a red "End Call" button next to the mute toggle
- **Add a "Voice active" indicator** that's unmistakable — e.g., a colored bar at the top of the chat window, or a pulsing border on the entire chat panel
- **Render markdown in model messages** — use a lightweight markdown renderer for bold, italics, lists, and headers
- **Improve topic chip queries** — use more natural phrasing: "About the Artist" → "Who was {artist}?", "Historical Context" → "What's the history behind this painting?"
- **Update the empty state** — show two distinct entry points: "Type a question" pointing at the input, and "Start voice conversation" pointing at a mic button
- **Add message actions** — long-press or tap-to-copy on model messages

**Files:** `components/ChatWindow.tsx`, `hooks/useGeminiLive.ts`

---

## 8. History: Past Scans

**Current:** A side drawer slides in from the left. Shows a list of previously scanned artworks with thumbnail, title, artist, and timestamp. Tapping one loads it into the result view.

### Problems

**History is in-memory only.** It's stored in React state (`App.tsx:32`). Refreshing the page erases everything. For museum visitors who scan 10+ artworks over an hour, losing history is devastating.

**No delete or clear.** There's no way to remove individual items or clear all history. On a shared device or demo, this is a problem.

**No search or filter.** If a user scans 20 artworks, finding a specific one means scrolling through the entire list.

**Thumbnails are full-resolution data URLs.** Each history item stores the entire base64 JPEG in memory. After 10+ scans, this could consume hundreds of megabytes of RAM and slow the app.

**No indication that history is temporary.** Users may assume their history is saved, only to discover it's gone on their next visit.

**The history button is only visible when no result is showing.** If a user wants to compare their current scan with a previous one, they must close the result first.

### Suggested Improvements

- **Persist history to `localStorage` or IndexedDB** — IndexedDB is better for image blobs. Store compressed thumbnails (200px wide) separately from full-resolution images
- **Add swipe-to-delete** on individual items, and a "Clear All" action in the header
- **Add a search bar** at the top of the drawer — filter by title or artist name
- **Show a "History is saved on this device" notice** — or if not persisted, show "History will be lost when you close the app"
- **Make history accessible from the result view** — keep the history button visible at all times, or add it to the result card header
- **Add a visual badge** on the history button showing the count of saved items (e.g., a small number bubble)

**Files:** `App.tsx:32`, `components/HistoryDrawer.tsx`

---

## 9. Navigation & State: Dead Ends

### Problems That Span Multiple Screens

**No global navigation.** The app is a linear flow with no way to go back. Once past language/onboarding, the user can't change their language or persona without reloading. There's no settings screen, no profile, no about page.

**No settings access.** The user chose a persona and language at the start and can never change them. Add a settings icon (gear) to the camera view's top bar that opens a modal with:
- Language selector
- Persona selector
- Name change
- Clear history
- About/credits

**Closing the result card fully resets state.** Pressing X on the result card calls `handleReset()` which clears everything — the result, the image, annotations, chat, and deep analysis. There's no "go back to this result" after closing. The user has to re-scan or find it in history (if it hasn't been lost to a refresh).

**No confirmation before destructive actions.** Closing a result during an active voice chat immediately disconnects the voice session and destroys all state. There's no "Are you sure?" prompt.

**Error messages are not localized.** The error banner (`App.tsx:212-226`) shows messages in English regardless of language selection. The camera permission denied message is also English-only.

### Suggested Improvements

- **Add a settings gear icon** to the HUD top bar (next to the ArtLens badge). This opens a settings panel where users can change language, persona, name, and clear history
- **Don't fully destroy result state on close.** Instead, keep the last result available. Show a "Last scan" option in history or add a "recall" gesture
- **Add confirmation dialogs** for destructive actions — closing a result during voice chat, clearing history
- **Localize all error messages and UI strings** — create an i18n utility that all components use, keyed by language

**Files:** `App.tsx:150-157`, `App.tsx:212-226`, `components/CameraFeed.tsx:57-64`

---

## 10. Mobile-Specific Issues

**Current:** The app targets mobile via `viewport-fit=cover`, `100dvh`, safe area insets, and `touch-action: none`. But several interactions are desktop-first.

### Problems

| Issue | Location | Impact |
|---|---|---|
| Annotation tooltips use hover states | `ImageAnnotationLayer.tsx:66` | Invisible on mobile |
| No haptic feedback on scan | `App.tsx` | Scan feels inert on mobile |
| Drag handle says "touch-none" but also has click handler | `AnalysisResultCard.tsx:93` | Confusing pointer behavior |
| Keyboard covers input when typing in chat | `ChatWindow.tsx:262-269` | Input may be obscured on small phones |
| No pull-to-refresh or swipe gestures | — | Feels like a website, not an app |
| `touch-action: none` on body | `index.html:63` | Kills all native scroll/zoom on the entire page |

### Suggested Improvements

- **Replace hover-based tooltips** with always-visible labels or tap-to-reveal
- **Add navigator.vibrate()** on successful scan (short 50ms pulse) and on capture (100ms)
- **Handle keyboard appearance** in chat — scroll to bottom and adjust viewport when the soft keyboard opens
- **Consider removing `touch-action: none` from body** and applying it only to the camera layer. Currently it prevents native scroll in the chat and result card (which are handled by overflow-y-auto, but it's still fragile)
- **Add swipe-down on the result card** to minimize it (gesture-based, not just the drag handle click)
- **Add pull-down on the chat** to close it
- **Test on Safari iOS** — `100dvh`, `backdrop-blur`, and Web Audio API all have known quirks on Safari

**Files:** `index.html:63`, `components/ImageAnnotationLayer.tsx`, `components/AnalysisResultCard.tsx`

---

## Priority Summary

### Do First (High Impact, Low Effort)

1. Persist language + user context to localStorage
2. Localize all UI strings (shutter text, error messages, button labels)
3. Dynamic "Chat with {persona}" button label
4. Display the `technicalAnalysis` field that's already being fetched
5. Debounce the shutter button
6. Show annotation labels on mobile (replace hover)

### Do Next (High Impact, Medium Effort)

7. Persist history to localStorage/IndexedDB
8. Add settings gear (language, persona, name change)
9. Progressive result loading (show title/artist before full analysis)
10. Separate voice and text chat entry points
11. Add share button (Web Share API)
12. Add back navigation from onboarding to language

### Do Later (Medium Impact, Higher Effort)

13. Scan animation overhaul
14. Annotation region highlights and prev/next navigation
15. Markdown rendering in chat messages
16. Camera controls (flip, torch, zoom)
17. PWA manifest + service worker
18. Proper Tailwind build (replace CDN)
