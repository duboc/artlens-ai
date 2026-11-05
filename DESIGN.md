# DESIGN.md — ArtLens AI (as built)

Contract for the visual system that exists in code today. Source of truth for tokens: `index.html`
(`:root` vars + inline `tailwind.config`). Extend this world; do not start a new one.
Product context: [PRODUCT.md](PRODUCT.md). Surface brief: `.impeccable/surfaces/App.tsx.md`.

## 1. Visual world

- **Metaphor**: a personal field ledger held up against the gallery. The camera is the page; UI is a
  thin dark instrument layer over it (glass HUD), and everything off-camera reads like an open
  Swiss-style ledger: hairline rows, right-aligned tabular numbers, one signal hue.
- **Register**: quiet, confident, Google-native. Dark tinted ground so the artwork and the camera feed
  stay the brightest thing on screen. No confetti, no game cards, no KPI tiles.
- **Theme**: dark only (no light theme). Portrait, mobile-first, single column `max-w-lg` (32rem).

## 2. Color roles (pinned — do not change values)

| Role | Token / Tailwind | Value | Use |
|---|---|---|---|
| Ground | `--bg` | `#0e1012` | Body, full-height panels (`PanelShell`), welcome screen |
| Surface | `--surface` / `surface` | `#1a1a1a` | Bottom nav, toast, unselected segment, icon buttons |
| Surface variant | `--surface-variant` / `surface-variant` | `#242424` | Secondary icon-button fill (result-card close) |
| Ink | `--text` | `#e8eaed` | Primary text. Muted body = `text-[var(--text)]/80` (min `/70`) |
| Muted ink | `--secondary` / `text-secondary` | `#9aa0a6` | Labels, summaries, units, inactive tabs (7.2:1 on `--bg`) |
| Hairline | `border-white/[0.08]` | — | Ledger rules, nav top border, sheet edge. Inner rules `/[0.06]`; quiz option idle `/[0.12]` |
| Signal | `--primary` / `primary` | `#4285F4` | The ONE state hue: active tab, done pip, earned points, links, focus ring, reticle |
| Signal fill (small text) | `primary-dark` | `#3367D6` | Filled CTAs and count badges carrying white text ≤18px (5.2:1). `#4285F4`+white is only 3.6:1 |
| Signal tint | `--primary-dim` | `rgba(66,133,244,.12)` | "You" row in Ranking; also `bg-primary/10–15` for selected segment / pressed |
| On signal | `onPrimary` | `#ffffff` | Text/icons on blue fills |
| Error | `error` | `#ea4335` | Wrong quiz answer, load errors (`border-error/30`), logout text |
| Success | `success` | `#34a853` | Correct quiz answer only |
| Brand dots | `gRed gYellow gGreen gBlue` | Google 4-color | **Brand accent only**: welcome screen + HUD "AI Academy" badge. Never for state |

Rules: one signal hue per screen — status is blue vs. muted, not a rainbow. Success/error appear only as
quiz feedback and error states. Selection: `::selection { background: rgba(66,133,244,.35); color:#fff }`.

## 3. Typography

| Face | Tailwind | Role |
|---|---|---|
| Google Sans | `font-serif` (alias — it is NOT a serif) | Display: panel H1, artwork title, quiz question/result, badge wordmark |
| Google Sans Text | `font-sans` (body default) | All UI and reading text |
| JetBrains Mono | `font-mono` + `.tabular` | **Numbers and measurements only**: points, ranks, counts, latency, model id |

Scale actually in use (12px floor — nothing smaller is allowed in new code):

| Step | Size | Where |
|---|---|---|
| `text-xs` | 12px | Tab labels, units ("pts"), sub-lines in rows, scoring note |
| `text-sm` | 14px | Body copy in sheets/panels, secondary actions, fact rows, legends |
| `text-base` | 16px | Ledger row titles, quiz options, points in pill/rows. Inputs forced to 16px (iOS zoom) |
| `text-lg` | 18px | Welcome language options |
| `text-xl` | 20px | Quiz question (`font-serif leading-snug tracking-tight`) |
| `text-2xl` | 24px | Artwork title in result sheet; `+N` award in toast (mono) |
| `text-3xl` | 30px | Panel H1 (Missions / Ranking / Profile), quiz result sentence |
| `text-4xl` | 36px | Welcome title only |

- Headings: `tracking-tight` (−0.025em). Never tighter than −0.04em.
- Reading measure: prose blocks carry `max-w-[60ch]` (target 55–75ch). `leading-relaxed` for prose,
  `leading-snug` for row titles.
- Hierarchy comes from size + weight (`font-medium`) + ink (`--text` vs `secondary`), not from
  uppercase kickers or shrinking text.
- Any digit that can change sits in `.tabular` (`font-variant-numeric: tabular-nums`); summaries that
  embed numbers also get `.tabular`.

## 4. Spatial grammar

- **Column**: `max-w-lg mx-auto px-6`. Panels: header `pt-12 pb-6`, then optional intro, then ledger
  `mt-8`; control groups (fieldsets) separated by `mt-10`. Bottom padding = nav height (64px) + 48px.
- **Ledger rows (the default list)**: `<ol class="border-t border-white/[0.08]">`, each
  `<li class="py-4 border-b border-white/[0.08] flex gap-4">` — leading glyph (StatusPip or rank),
  flexible text block (`min-w-0`, truncate), trailing right-aligned mono number. Density variants:
  rank rows `py-3.5`, fact rows (`dl`) `py-2.5` with `/[0.06]` rules, nav rows `min-h-[56px]`.
- **Summary sentence, not KPI tiles**: each panel states its numbers in one sentence under the H1
  ("3 of 8 missions · 120 pts").
- **Safe areas**: `pt-safe` / `pb-safe` / `safe-top` / `safe-bottom` helpers; `h-dvh` with vh fallback.

### Anti-bloat guardrails (enforced)
- No card-per-row boxes; no nested cards; no identical icon-heading-text card grids.
- No `border-left|top: 3–6px solid` status stripes — use `StatusPip` or a typographic badge.
- No uppercase tracked eyebrow kickers above headings; no text under 12px.
- No 4-tile KPI strip; no gradient text; no zero-offset glow halos in new work.

## 5. Shape & elevation

- **Radii**: `rounded-full` for every control (CTAs, segmented options, icon buttons, pills, nav badge);
  result sheet top corners 28px at the medium detent → 0 at full (edge-to-edge, like a native sheet);
  `rounded-2xl` toast + welcome language options; `rounded-xl` quiz options; `rounded-lg` meta badges.
- **Layers (z)**: camera < HUD `z-10` < panels `z-30` < BottomNav `z-40` < ResultSheet / AwardToast / LanguageSelector `z-50`.
- **No glass**: HUD chips over the camera use `.warm-glass`, now a near-opaque carbon surface
  (`rgba(22,24,27,.92)`, no blur). The result sheet is opaque `--surface` with shadow `0 -6px 24px rgba(0,0,0,.45)`.
- **Opaque everywhere else**: panels on `--bg`, nav and toast on `--surface`. Toast shadow
  `0 8px 24px rgba(0,0,0,.45)` (offset + blur — the model for any new shadow).

## 6. Components (canonical implementations)

- **BottomNav** (`components/game/BottomNav.tsx`): 4 tabs Scan · Missions · Ranking · Profile, 64px bar
  above safe area, 24px line icons + 12px label, active = `text-primary` + `aria-current="page"`.
  Open-missions count = mono badge on `primary-dark`. Hidden while chat/quiz is immersive.
- **Points pill** (HUD top-right): glass, `h-11`, mono number + 12px unit, opens Missions.
- **StatusPip** (`icons.tsx`): 24px; done = filled blue disc + check, open = 1.5px ring `secondary/60`.
  `role="img"` + label. Icons: 24px grid, 1.5px stroke, round caps.
- **Ledger row / Fact row / Nav row**: see §4; trailing value always mono, right-aligned.
- **Segmented control** (Profile): `fieldset`+`legend`, `role="radiogroup"`, pill radios `min-h-[44px]`;
  selected `bg-primary/15 text-primary border-primary/40`, idle `bg-[var(--surface)] border-white/[0.08]`.
- **Primary CTA**: `min-h-[48px] w-full rounded-full bg-primary-dark text-onPrimary text-sm font-medium`,
  `active:scale-[0.98]`. Secondary: outline pill `border-primary/30`. Tertiary: text button `text-primary`.
- **ResultSheet** (`components/result/ResultSheet.tsx`, physics in `components/sheet/sheetPhysics.ts`):
  the post-scan surface. A full-height `role="dialog"` that follows the finger, with two detents
  (medium = 50% of the viewport, full = 100%) plus close. Release projects the flick with the UIScrollView
  deceleration rate (0.998), snaps to the nearest detent, and flicks over 500 px/s move one detent. It
  rubber-bands above the top (c = 0.55) and settles with a critically damped spring (response 0.42 s).
  Constants come from Apple WWDC18 "Designing Fluid Interfaces" and Android `BottomSheetBehavior`.
  Header: 40×5 handle, "Scan n of N", 44px close. System back / edge swipe / Escape close chat or quiz
  first, then the sheet (History API). Swiping sideways pages through earlier scans (scroll-snap pager).
- **Photo stage** (`CameraFeed` `staged`): with a result open, the whole frozen photo fits above the
  medium sheet (`.photo-stage`, Google Lens style) and follows the page being viewed. At full,
  each page's own photo (`object-contain`, the whole artwork) slides into the sheet (`.sheet-hero`),
  so the photo is never shown twice.
- **NarrationPanel** (`components/result/NarrationPanel.tsx`): 48px primary round button (Play / Pause /
  Resume / Listen again; a spinner + `aria-busy` while the guide gets ready) + 44px "Listen again" while
  paused + a Listen / Read only radiogroup (44px radios, arrow keys, remembered in `localStorage`). Below
  it: the narration text, 18px, `max-w-[60ch]`, `.selectable`; the spoken sentence gets
  `aria-current="true"` + `bg-primary/25`; already-read text is `text/75`, upcoming text is `secondary`.
  At medium the text is a window of 1–3 lines (whatever fits above the bottom edge) that scrolls to
  follow the spoken sentence; at full the whole text shows.
- **AwardToast**: while a result is open (`inline`) it is one 44px line in the sheet header's left slot
  (mono `+N` in blue · what was earned · arrow to Missions). It causes no layout shift and never sits over the
  title or the audio controls; "Scan n of N" returns when it dismisses. Otherwise it floats at the top, below the status bar (+72px). Big mono `+N` in blue, itemized
  lines with muted mono points, optional "View missions" link; `role="status" aria-live="polite"`, auto-dismiss 6s.
- **Quiz option**: idle → right (`border-success/60 bg-success/15` + check) / wrong (`error` + cross) /
  dim (others). Explanation + next CTA appear below; haptic via `navigator.vibrate`.
- **AiTracePanel** ("How the AI thought"): disclosure row (`min-h-[52px]`, `aria-expanded`), latency in
  mono at rest; opens to a fact `dl`, 3-bar ConfidenceMeter, search queries, source links (44px rows).

## 7. Motion

- **The one authored celebratory moment**: `.award-toast` — 0.55s `cubic-bezier(.16,1,.3,1)`, from −16px / 0.98 /
  6px blur to rest. Don't add a second celebratory animation.
- **Gesture physics (functional, not decorative)**: the ResultSheet spring and rubber-band above. While
  the finger moves, only `transform` and the non-inherited `--sheet-full` (corner radius) change: no
  layout, no React render per frame. On release the detent is written to `data-detent` directly (no React
  render), and CSS follows it with `cubic-bezier(.32,.72,0,1)`: the hero photo slides in by `transform`
  (320ms, compositor only) and the header picks up the safe-area padding (280ms).
- **Photo morph**: on scan, the full-screen frozen frame morphs into the photo stage via the View
  Transitions API (`scan-photo`, 420ms, same curve) while the sheet rises on its spring. Root crossfade is off.
- **Instant**: tab panels mount with no transition. Quiz question swaps and disclosure content use
  `animate-fade-in` (0.4s). Caption highlight: 200ms color transition.
- **Functional loops only**: scan-line sweep while analyzing, refresh `animate-spin`, spinners.
- **Feedback**: `active:scale-[0.98]` (pills `0.95`), color transitions 200–300ms.
- **Reduced motion** (`index.html`): all animations/transitions collapse to 0.01ms, glass blur removed
  (surface @95%), noise overlay hidden. New motion must survive this rule.

## 8. States & accessibility

- **Loading**: summary line reads "Loading…" (`aria-live="polite"`); spinner = 24px ring
  `border-primary/30 border-t-primary`; deep-analysis skeleton = pulsing `primary/5–10` bars.
- **Error**: `LoadError` — inline row between `border-y border-error/30`, message + "Retry" text button
  (44px), `role="alert"`. Never a modal.
- **Empty**: one muted sentence between hairlines (`py-6 border-y`), e.g. Ranking with no players.
- **Focus**: global `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px }`.
- **Targets**: ≥44px for every control (`min-h-[44px]`, `w-11 h-11`, `.touch-target`); 48px for CTAs.
- **Contrast**: text ≥4.5:1. Don't use `secondary` below full opacity for readable text.

## 9. Legacy exceptions (pre-existing — retire, never copy)

| Where | Exception | Retire toward |
|---|---|---|
| `LanguageSelector` "Museum Companion" | Uppercase tracked kicker | Sentence-case `text-secondary` subtitle |
| `glowPulse` on HUD shutter | Zero-offset blue halo | Static ring; no glow |
| `HistoryDrawer`, `Gallery`, `ChatWindow` | `text-[10px]` | `text-xs` minimum |
| Various | `secondary/30–70` text, "gold" comments (palette is blue now) | Full `secondary`; fix naming when touched |

Retired in the native-sheet pass: the `.text-shimmer` gradient title (now a solid `--text` title over the
`.google-gradient` bar), `.border-gold-glow`, the 24px blur on `.warm-glass`, and `AnalysisResultCard`
with its kickers, tinted cards and sub-44px buttons (replaced by ResultSheet + ScanPage).
