## Surface: ArtLens game layer (Missions · Ranking · Me) + "How the AI thought"

Scope: extension of the existing ArtLens mobile camera app for the Museo Reina Sofía event (Madrid, <1 week). Visitor mode: operate (on a phone, standing in a gallery, one hand, glanceable).
Audience: AI Leadership Academy attendees visiting the museum; individual challenges, individual ranking on the phone, no time limit, no teams.
Must stay: current visual world (dark ground, Google blue primary, Google Sans), camera-first scan flow, chat/voice, portrait.

## Direction contract

THESIS: A museum visit becomes a personal field ledger: every scan can tick a mission, earn points and climb a ranking, and every identification can be opened to show how the AI reached it. Refuses the category default of confetti game cards and 4-tile KPI dashboards.

OWN-WORLD: Pinned by the user: keep the existing dark ground (#1a1a1a family), Google blue (#4285F4) as the single signal hue, Google Sans / Google Sans Text, JetBrains Mono only for numbers (tabular-nums). Discipline donated by the rolled seed (Swiss monograph ledger): open hairline ledger rows instead of boxed cards, tabular numerals right-aligned, one signal hue for state.

STORY: The visitor scans, sees what they earned in a quiet toast, checks Missions to plan the next room, glances at Ranking, and opens "How the AI thought" to see the model, time, Google searches, sources and confidence behind the answer.

FIRST VIEWPORT: Camera stays full-bleed; a bottom tab bar (Scan · Missions · Ranking · Me) with 44px targets; points pill top-right replaces the old settings gear. Missions/Ranking/Me are full-height panels: heading, one typographic summary sentence, then hairline ledger rows.

FORM: Extension of the established world; ledger rows from the rolled seed. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Surface extension: native post-scan sheet + readable narration

THESIS: The scan result should feel like a native app, not a web modal. It is a sheet that follows the finger, stops where Google Lens and Apple Maps stop, and gives the voice a readable, controllable transcript.

OWN-WORLD: Unchanged and pinned: dark ground, Google blue as the single signal, Google Sans, mono for numbers. Nothing decorative was added. The motion is physical (spring, rubber band, photo morph), not celebratory.

STORY: Scan → the frozen frame shrinks to fit above a rising sheet → the title, the Play/Pause button and the guide's words appear, with the spoken sentence highlighted → drag to full to read more → swipe sideways to earlier scans → system back to return to the camera.

CONTRACT:
- Detents medium 50% / full. Physics from primary sources (Apple WWDC18, Android BottomSheetBehavior); no invented curves.
- While dragging, only `transform` changes. Layout follows the detent after release.
- The points notice lives in the sheet header and never covers the title or the audio controls.
- The photo is never shown twice: the stage above the sheet at medium, the hero inside the sheet at full.
- Narration state never re-renders the app tree (NarrationProvider).
- Caption sync uses only Gemini Live data (no STT), validated on recorded sessions with a held-out set.

