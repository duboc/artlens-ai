import { Language } from '../types';

export type LocalizedText = Record<Language, string>;

export interface ArtworkRef {
  title: string;
  artist: string;
}

/** A museum-specific quick-question chip shown in the chat. */
export interface MuseumTopic {
  id: string;
  label: LocalizedText;
  /** English prompt sent to the model when the chip is tapped. */
  prompt: (art: ArtworkRef) => string;
}

/**
 * An individual challenge. A scan completes the mission when Gemini judges
 * that the identified artwork satisfies `criterion` (evaluated server-side).
 */
export interface Mission {
  id: string;
  title: LocalizedText;
  /** One-line hint shown to the visitor. */
  hint: LocalizedText;
  /** English rule for the model judging a scanned artwork. */
  criterion: string;
  points: number;
}

/**
 * Everything that makes the experience specific to one venue. Add a new file
 * in museums/ and register it in museums/index.ts to support another museum;
 * select it per deployment with MUSEUM_ID (or ?museum=<id> for testing).
 */
export interface MuseumProfile {
  id: string;
  /** Full official name, used in model prompts. Empty for the generic profile. */
  name: string;
  /** Short display name. */
  shortName: string;
  city?: string;
  /** Small footer line on the welcome screen, e.g. "Madrid 2026". */
  eventLabel?: string;
  /** Paragraph describing the venue, building and collection (for prompts). */
  guideContext: string;
  /** "When relevant" guidance bullets for the guide (for prompts). */
  guideTips: string[];
  /** Extra hint appended to the artwork identification prompt. */
  identifyHint?: string;
  /** Museum-specific chat topic chips. The first one is shown right after "About the artist". */
  topics: MuseumTopic[];
  /** Individual challenges for the game layer (Missions tab). */
  missions: Mission[];
}
