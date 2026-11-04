import { generic } from './generic';
import { mnac } from './mnac';
import { reinaSofia } from './reinaSofia';
import { MuseumProfile } from './types';

export type { MuseumProfile, MuseumTopic, Mission, LocalizedText, ArtworkRef } from './types';

export const MUSEUMS: Record<string, MuseumProfile> = {
  [generic.id]: generic,
  [reinaSofia.id]: reinaSofia,
  [mnac.id]: mnac,
};

export const DEFAULT_MUSEUM_ID = generic.id;

/**
 * Pick the museum: a valid ?museum=<id> URL override wins (handy for testing),
 * then the deployment's MUSEUM_ID, then the generic profile.
 */
export function resolveMuseumId(queryId?: string | null, serverId?: string | null): string {
  for (const id of [queryId, serverId]) {
    const normalized = id?.trim().toLowerCase();
    if (normalized && MUSEUMS[normalized]) return normalized;
  }
  return DEFAULT_MUSEUM_ID;
}

let current: MuseumProfile = generic;

/** Look up a profile by id (falls back to generic). Safe to use on the server. */
export function getMuseumById(id?: string | null): MuseumProfile {
  return MUSEUMS[resolveMuseumId(id)];
}

export function getMuseum(): MuseumProfile {
  return current;
}

export function setMuseum(id: string): MuseumProfile {
  current = MUSEUMS[resolveMuseumId(id)];
  return current;
}

/**
 * Resolve the active museum at startup from the URL and GET /api/config.
 * Never throws: falls back to the generic profile if the server is unreachable.
 */
export async function loadMuseum(): Promise<MuseumProfile> {
  const queryId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('museum')
    : null;
  let serverId: string | null = null;
  try {
    const res = await fetch('/api/config', { signal: AbortSignal.timeout(3000) });
    if (res.ok) serverId = (await res.json()).museumId ?? null;
  } catch {
    // offline or slow: use the URL override or the generic profile
  }
  return setMuseum(resolveMuseumId(queryId, serverId));
}

/** Opening line identifying who the guide is and where. */
export function guideIntro(museum: MuseumProfile = current): string {
  return museum.name
    ? `You are the museum guide for the Google Cloud AI Leadership Academy visit to the ${museum.name}.`
    : 'You are a museum guide for the Google Cloud AI Leadership Academy.';
}

/** MUSEUM CONTEXT block for system prompts. */
export function museumContextBlock(museum: MuseumProfile = current): string {
  const tips = museum.guideTips.map((tip) => `- ${tip}`).join('\n');
  return `MUSEUM CONTEXT:\n${museum.guideContext}\n\nWhen relevant:\n${tips}`;
}
