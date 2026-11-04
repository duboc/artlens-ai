import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  MUSEUMS,
  DEFAULT_MUSEUM_ID,
  resolveMuseumId,
  setMuseum,
  getMuseum,
  guideIntro,
  museumContextBlock,
} from '../museums';
import { LanguageSelector } from '../components/LanguageSelector';

const ROOT = join(__dirname, '..');

describe('museum profiles', () => {
  afterEach(() => {
    setMuseum(DEFAULT_MUSEUM_ID);
  });

  it('resolves the URL override first, then the server id, then generic', () => {
    expect(resolveMuseumId('mnac', 'reina-sofia')).toBe('mnac');
    expect(resolveMuseumId(null, 'reina-sofia')).toBe('reina-sofia');
    expect(resolveMuseumId('  Reina-Sofia ', null)).toBe('reina-sofia');
    expect(resolveMuseumId('unknown', 'reina-sofia')).toBe('reina-sofia');
    expect(resolveMuseumId('unknown', 'also-unknown')).toBe('generic');
    expect(resolveMuseumId(undefined, undefined)).toBe('generic');
  });

  it('setMuseum falls back to generic for unknown ids', () => {
    expect(setMuseum('reina-sofia').id).toBe('reina-sofia');
    expect(getMuseum().id).toBe('reina-sofia');
    expect(setMuseum('nope').id).toBe('generic');
  });

  it.each(Object.values(MUSEUMS))('$id has complete topics and context', (museum) => {
    expect(museum.guideContext.length).toBeGreaterThan(20);
    expect(museum.topics.length).toBeGreaterThan(0);
    const ids = museum.topics.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of museum.topics) {
      expect(topic.label.en && topic.label.es && topic.label.pt).toBeTruthy();
      const prompt = topic.prompt({ title: 'Guernica', artist: 'Pablo Picasso' });
      expect(prompt).toContain('Guernica');
    }
    expect(museumContextBlock(museum)).toContain(museum.guideContext);
  });

  it('builds a venue-specific or generic guide intro', () => {
    expect(guideIntro(MUSEUMS['reina-sofia'])).toContain('Museo Nacional Centro de Arte Reina Sofía');
    expect(guideIntro(MUSEUMS.generic)).not.toMatch(/visit to/);
  });

  it('shows the event label on the welcome screen only when the profile has one', () => {
    setMuseum('reina-sofia');
    const { unmount } = render(React.createElement(LanguageSelector, { onSelect: () => {} }));
    expect(screen.getByText('Madrid 2026')).toBeTruthy();
    unmount();

    setMuseum('generic');
    render(React.createElement(LanguageSelector, { onSelect: () => {} }));
    expect(screen.queryByText(/20\d\d$/)).toBeNull();
  });
});

describe('no hardcoded venue outside museums/', () => {
  const SOURCE_DIRS = ['components', 'hooks', 'services', 'utils', 'server'];
  const files: string[] = ['App.tsx', 'index.tsx'];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const rel = join(dir, entry);
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(rel);
    }
  };
  SOURCE_DIRS.forEach(walk);

  it.each(files)('%s has no MNAC / Barcelona / Catalan references', (file) => {
    const src = readFileSync(join(ROOT, file), 'utf-8');
    expect(src).not.toMatch(/MNAC|Barcelona|Catalan|Catalunya|Reina Sof/i);
  });
});
