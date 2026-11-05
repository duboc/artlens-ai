import { describe, it, expect } from 'vitest';
import { narrationPrompts, narrationOpening, NEW_VISIT_AFTER_MS, BRIDGE_WITHIN_MS } from '../utils/narrationPrompt';

const now = 1_800_000_000_000;
const base = {
  museumIntro: 'You are the museum guide.',
  personality: 'Warm.',
  languageName: 'Spanish',
  visitorName: 'Ana',
  artwork: { title: 'Guernica', artist: 'Pablo Picasso', year: '1937' },
  now,
};

describe('narration opening: greet once per visit, then continue', () => {
  it('greets by name at the first artwork', () => {
    const p = narrationPrompts({ ...base, previous: null });
    expect(p.opening).toBe('greet');
    expect(p.system).toMatch(/Greet the visitor by their first name/);
    expect(p.user).toMatch(/greet them by name/);
  });

  it('continues the tour without greeting at later artworks', () => {
    const p = narrationPrompts({ ...base, previous: { title: 'La botella de Anís del Mono', artist: 'Juan Gris', at: now - 5 * 60_000 } });
    expect(p.opening).toBe('continue');
    expect(p.system).not.toMatch(/Greet the visitor by their first name/);
    expect(p.system).toMatch(/Do NOT greet the visitor/);
    expect(p.user).toMatch(/do not greet them again/);
  });

  it('may bridge from a recent previous artwork, but not from an old one', () => {
    const recent = narrationPrompts({ ...base, previous: { title: 'Retrato II', artist: 'Joan Miró', at: now - 10 * 60_000 } });
    expect(recent.user).toMatch(/Previous stop: "Retrato II" by Joan Miró/);
    const older = narrationPrompts({ ...base, previous: { title: 'Retrato II', artist: 'Joan Miró', at: now - BRIDGE_WITHIN_MS - 1 } });
    expect(older.opening).toBe('continue');
    expect(older.user).not.toMatch(/Previous stop/);
  });

  it('greets again when the visitor comes back hours later (a new visit)', () => {
    expect(narrationOpening({ title: 'x', artist: 'y', at: now - NEW_VISIT_AFTER_MS - 1 }, now)).toBe('greet');
    expect(narrationOpening({ title: 'x', artist: 'y', at: now - 60_000 }, now)).toBe('continue');
  });

  it('keeps the artwork facts and the language rule', () => {
    const p = narrationPrompts({ ...base, previous: null });
    expect(p.user).toMatch(/- Title: Guernica/);
    expect(p.system).toMatch(/Speak entirely in Spanish/);
  });
});
