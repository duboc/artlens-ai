# ArtLens AI: User Flow and UX Guide

This document maps out the user journey, state management, and user experience (UX) design principles of the ArtLens AI frontend application. It is intended for frontend developers and designers working on the React/Vite application.

---

## 1. Global State Management

The application flow is orchestrated primarily within `App.tsx` acting as a finite state machine.

### Core States
The app progresses through three distinct, mutually exclusive main states based on the presence of data in `localStorage`:

1.  **Language Selection:** `language === null`
2.  **Onboarding:** `userContext === null` (but language is set)
3.  **Main Application:** Both `language` and `userContext` are present.

### Persistence
To provide a seamless experience across reloads, critical state is persisted in `localStorage`:
-   `artlens_language`: 'en', 'pt', or 'es'.
-   `artlens_userContext`: JSON object containing the user's name, email, chosen persona, and optionally a selfie URL.
-   `artlens_history`: JSON array of previously scanned artworks and their analysis results.

---

## 2. User Journey Mapping

### Phase 1: First-Time Setup (Onboarding)

**A. Language Selection (`LanguageSelector.tsx`)**
-   **Visuals:** Minimalist, staggered fade-in animations (`animate-reveal`).
-   **Interaction:** Single tap to select the preferred language (English, Portuguese, or Spanish).
-   **Outcome:** Sets the `language` state and transitions to the Onboarding Form.

**B. Onboarding Form (`OnboardingForm.tsx`)**
A multi-step, localized wizard.
-   **Step 1: Identity:** User enters Name and Email. Includes a "Skip" option that creates a "Guest" profile.
-   **Step 2: Selfie Capture (Optional):** Prompts the user to take a selfie using the device's front-facing camera. Used later for the "Generate Me" feature.
-   **Step 3: Persona Selection:** User selects an AI personality (Guide, Academic, Blogger).
-   **Backend Sync:** Upon completion, a `userId` is generated via a POST request to the backend, and the user's context is saved locally.

### Phase 2: Core Experience (Main App View)

Once onboarded, the user drops directly into the live camera view (`CameraFeed.tsx`).

**A. Scanning & Identification**
-   **Action:** User taps the shutter button in the `HUDOverlay`.
-   **UX Feedback:** A haptic vibration triggers (if supported), a white camera flash (`capture-flash`) overlays the screen momentarily, and the live video feed is frozen (`frozenImage` state).
-   **Processing:**
    1.  The frame is captured via a hidden `<canvas>`.
    2.  `isAnalyzing` is set to true, disabling further input.
    3.  A call is made to `identifyArtwork()` (Gemini Vision).
    4.  A background call is triggered to `getDeepArtworkAnalysis()` for historical context.
-   **Result:** The `AnalysisResultCard` slides up from the bottom, displaying the title, artist, year, and a brief description.

**B. Exploration & Interaction**
-   **Annotations:** If the AI identified specific regions of interest (e.g., a specific symbol in a painting), pulsating dots appear over the frozen image (`ImageAnnotationLayer`). Tapping a dot opens an `AnnotationCard` detailing that specific element.
-   **Deep Analysis:** As the background deep analysis completes, the `AnalysisResultCard` silently updates to include accordion sections for "Historical Context", "Symbolism", etc.
-   **Chat:** The user can initiate a text or voice chat with their chosen AI persona by tapping the chat button on the result card.

### Phase 3: Secondary Features

-   **History Drawer:** Accessed via a button on the HUD. Slides in from the left to display past scans. Tapping an item restores its frozen image and analysis result without requiring a new API call.
-   **Generate Me:** Accessible from the `AnalysisResultCard`. Takes the user's previously captured selfie and the current artwork's style data, sends it to the backend (`/api/generate-image`), and displays the newly generated artistic portrait in a modal.
-   **Gallery:** A grid view of all AI-generated portraits the user has created.

---

## 3. UX and UI Design Principles

### Theme & Aesthetics
-   **Dark Mode Native:** The app uses a dark theme exclusively (`bg-[var(--bg)]`) to allow the vibrant colors of the camera feed and artworks to stand out.
-   **"Warm Glass" UI:** UI overlays (cards, drawers) use a custom CSS class (`warm-glass`) that likely implements a frosted glass effect (backdrop blur + translucent background + subtle border) to maintain context with the camera feed beneath.
-   **Typography:** Combines a sophisticated serif font for headings (titles, onboarding prompts) with a clean sans-serif/mono font for UI elements and metadata.

### Interaction Patterns
-   **Staggered Animations:** Menus and lists (like the language selector and onboarding steps) use staggered CSS animations (`animate-reveal`, `animate-reveal-delay-1`) to guide the user's eye and create a polished, "breathing" interface.
-   **Non-Blocking UI:** Heavy operations (like uploading the selfie or fetching deep analysis) happen asynchronously in the background. The user is immediately presented with the primary identification results while the deeper data streams in.
-   **Graceful Error Handling:** Errors (e.g., API failures, camera permission denied) are displayed in a non-intrusive floating toast notification at the top of the screen, allowing the user to dismiss them and try again.
-   **Haptic & Visual Confirmation:** Actions like scanning provide immediate multi-sensory feedback (flash + vibration) to confirm the input was registered before the processing delay begins.
