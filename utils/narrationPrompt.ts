/**
 * Prompts for the short spoken introduction after a scan.
 *
 * The visitor is greeted only at the first stop of a visit. Later stops continue the tour:
 * no greeting, no opening with the visitor's name, and (when the previous stop was recent)
 * an optional one-clause bridge from the previous artwork if there is a genuine link.
 */

export interface PreviousStop {
  title: string;
  artist: string;
  /** When the previous artwork was scanned (ms since epoch). */
  at: number;
}

export interface NarrationPromptInput {
  /** Museum intro + context, already rendered (guideIntro + guideContext). */
  museumIntro: string;
  personality: string;
  languageName: string;
  visitorName: string;
  artwork: { title: string; artist: string; year?: string; style?: string; description?: string; funFact?: string };
  /** Most recent earlier stop of this visitor, if any. */
  previous: PreviousStop | null;
  now?: number;
}

/** A visit "restarts" (greeting again) after this long without scanning. */
export const NEW_VISIT_AFTER_MS = 3 * 60 * 60 * 1000;
/** Only bridge from the previous artwork if it was scanned this recently. */
export const BRIDGE_WITHIN_MS = 30 * 60 * 1000;

export type NarrationOpening = 'greet' | 'continue';

export function narrationOpening(previous: PreviousStop | null, now = Date.now()): NarrationOpening {
  return previous && now - previous.at < NEW_VISIT_AFTER_MS ? 'continue' : 'greet';
}

export function narrationPrompts(input: NarrationPromptInput): { system: string; user: string; opening: NarrationOpening } {
  const now = input.now ?? Date.now();
  const opening = narrationOpening(input.previous, now);
  const bridge = opening === 'continue' && input.previous && now - input.previous.at < BRIDGE_WITHIN_MS ? input.previous : null;

  const steps = opening === 'greet'
    ? [
        'Greet the visitor by their first name (this is the first artwork of their visit)',
        'Identify the artwork naturally (title, artist)',
        'Share one compelling detail — a story, hidden meaning, technique, or surprising fact',
        'End with a brief invitation to continue the conversation',
      ]
    : [
        'Do NOT greet the visitor and do NOT start with their name: this is not the first artwork of the visit, you are continuing an ongoing tour (no "hello", "hi", "welcome", "hola", "olá")',
        'Open by going straight into this artwork and identify it naturally (title, artist)',
        'Share one compelling detail — a story, hidden meaning, technique, or surprising fact',
        'End with a brief invitation to continue the conversation',
      ];

  const system = `${input.museumIntro}

Personality: ${input.personality}

You will narrate a short introduction (2-3 sentences, about 15-20 seconds) for a visitor who just scanned an artwork. You must:
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Rules:
- Speak entirely in ${input.languageName}
- Be natural and conversational
- Match the personality exactly
- Keep it tight — this is a 15-20 second intro, not a lecture`;

  const a = input.artwork;
  const user = [
    opening === 'greet'
      ? `Visitor name: ${input.visitorName} (first artwork of the visit: greet them by name).`
      : `Visitor name: ${input.visitorName} (already welcomed earlier in the visit: do not greet them again).`,
    bridge
      ? `Previous stop: "${bridge.title}" by ${bridge.artist}. Only if there is a genuine link, you may connect to it in one short clause; otherwise do not mention it.`
      : null,
    '',
    'Artwork:',
    `- Title: ${a.title}`,
    `- Artist: ${a.artist}`,
    `- Year: ${a.year || 'Unknown'}`,
    `- Style: ${a.style || ''}`,
    `- Description: ${a.description || ''}`,
    `- Fun fact: ${a.funFact || ''}`,
    '',
    'Begin your narration now.',
  ].filter((l) => l !== null).join('\n');

  return { system, user, opening };
}
