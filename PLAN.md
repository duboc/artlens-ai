# Voice Assistant UX — MNAC Museum Experience

## Goal
Transform the voice assistant from a passive Q&A tool into a proactive museum guide that feels like having a personal companion walking through MNAC with you.

## Checklist

- [x] **1 — MNAC-enriched system instruction** (`hooks/useGeminiLive.ts`)
  Rewrite the system instruction to include:
  - Museum identity: Museu Nacional d'Art de Catalunya, housed in the Palau Nacional on Montjuïc
  - Collection awareness: Romanesque (murals from Pyrenean churches), Gothic, Renaissance & Baroque, Modern Art (Modernisme — Gaudí, Casas, Rusiñol), Thyssen-Bornemisza collection
  - Behavioral guidance: proactively suggest related works at MNAC, connect pieces to the Catalan cultural narrative, mention where in the museum related works can be found
  - Conversational tone: speak as if walking alongside the visitor, use phrases like "if you look closely" or "just around the corner you'll find"

- [x] **2 — Auto-narration on connect** (`components/ChatWindow.tsx`)
  When `autoStartVoice` triggers and voice connects, immediately send an opening prompt via `sendTextInput` so the assistant starts narrating without user input. The prompt should instruct the assistant to greet the visitor by name and begin a compelling introduction to the artwork they just scanned.

- [x] **3 — Museum-relevant topic chips** (`components/ChatWindow.tsx`, `utils/i18n.ts`)
  Replace generic topic chips with visitor-oriented ones:
  - "Tell me a story" (primary, highlighted) — narrative hook
  - "What's nearby?" — suggest related MNAC works
  - "About the Artist" — keep
  - Annotation-based chips — keep
  - "Catalan Connection" — how this piece relates to Catalonia
  - "Compare Styles" — compare with other movements at MNAC
  - Remove "Historical Context" / "Symbolism" / "Style & Technique" as standalone chips (the guide should weave these in naturally)

- [x] **4 — Update empty state & connecting UX** (`components/ChatWindow.tsx`)
  - When `autoStartVoice` is active and connecting: show "Your guide is preparing..." with a subtle animation
  - When connected and waiting for first narration: show "Listening to your guide..."
  - Remove the manual "Start voice conversation" button from the empty state when auto-start is active (voice is already connecting)

- [x] **5 — i18n keys** (`utils/i18n.ts`)
  Add translation keys for new topic chip labels and updated empty-state text in en/pt/es.
