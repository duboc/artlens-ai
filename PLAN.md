# UX Feedback Improvements Plan

## 1. Gallery Icon — Replace Gemini sparkle with classic gallery icon
- [x] 1.1 Replace the sparkle SVG in `components/HUDOverlay.tsx:80-81` with a classic photo gallery icon (landscape photo icon)
- [x] 1.2 Replace the sparkle SVG in `components/Gallery.tsx:103-104` (empty state icon) with the same gallery icon for consistency

## 2. Post-Scan CTA — Guide the user after narration ends
- [x] 2.1 Add i18n keys for post-narration CTA text in `utils/i18n.ts`
- [x] 2.2 Add a CTA banner in `components/AnalysisResultCard.tsx` that appears when narration finishes — animated entrance, auto-dismisses after 8s

## 3. Remove Annotation Dots Overlay
- [x] 3.1 Remove `ImageAnnotationLayer` rendering from `App.tsx`
- [x] 3.2 Remove `AnnotationCard` rendering from `App.tsx`
- [x] 3.3 Remove `activeAnnotation` state and related handlers from `App.tsx`
- [x] 3.4 Clean up: removed `ImageAnnotationLayer.tsx` component file and its import
- [x] 3.5 Clean up: removed `AnnotationCard.tsx` component file and its import

## 4. Visual Share Cards with Branding (always image, no text-only)
- [x] 4.1 Created `utils/shareCard.ts` with `createArtworkShareCard()`, `addWatermark()`, and `shareOrDownload()`
- [x] 4.2 Updated `handleShare()` in `AnalysisResultCard.tsx` to generate branded card image (artwork photo + metadata + curiosity + branding)
- [x] 4.3 Updated share+download in `GenerateModal.tsx` to use `addWatermark()`
- [x] 4.4 Updated share+download in `Gallery.tsx` to use `addWatermark()`
- [x] 4.5 Downloads also apply watermark (GenerateModal + Gallery)
