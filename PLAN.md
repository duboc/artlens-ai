# Mobile Bug Fixes Plan

## 1. Screen Wake Lock — Prevent screen timeout during use
- [x] 1.1 Created `hooks/useWakeLock.ts` — wraps Screen Wake Lock API with feature detection, auto-reacquires on visibilitychange
- [x] 1.2 Activated wake lock in `App.tsx` on main camera view (after onboarding hooks)
- [x] 1.3 Added tests for wake lock hook (4 tests)

## 2. Scan Another — Make the re-scan action always reachable
- [x] 2.1 Added camera icon button to minimized pill view in `AnalysisResultCard.tsx` — calls `onScanAnother` directly
- [x] 2.2 Verified "Scan Another" button position is already above description/deepAnalysis in expanded card
- [x] 2.3 Added tests for scan-another in both pill and expanded views (4 tests)

## 3. Audio Concurrency — Kill stale sessions, prevent overlapping voices
- [x] 3.1 Added `narration.stop()` at top of `processImageAnalysis` in `App.tsx` — kills narration before network round-trip
- [x] 3.2 Added `visibilitychange` listener in `useGeminiLive.ts` — disconnects WebSocket when page goes hidden (root cause of two-voices bug)
- [x] 3.3 Added `visibilitychange` listener in `App.tsx` — stops narration TTS when app goes to background
- [x] 3.4 Added cleanup useEffect on unmount to `useNarration.ts`
- [x] 3.5 Added tests for visibility-based cleanup and code structure verification (6 tests)
