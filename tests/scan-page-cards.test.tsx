import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ScanPage } from '../components/result/ScanPage';
import { oneParagraph } from '../utils/text';
import type { IdentifyResponse } from '../types';

describe('oneParagraph', () => {
  it('keeps only the first paragraph', () => {
    expect(oneParagraph('First line here.\n\nSecond paragraph.')).toBe('First line here.');
  });
  it('cuts long text at a sentence boundary', () => {
    const t = 'One short sentence. ' + 'Another sentence that goes on for a while. '.repeat(10);
    const out = oneParagraph(t, 80);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('.')).toBe(true);
  });
  it('cuts a single huge sentence at a word with an ellipsis', () => {
    const out = oneParagraph('word '.repeat(100), 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
  });
});

const long = 'Painted in 1937 after the bombing of the Basque town. '.repeat(8) + '\n\nA second paragraph that should never show.';
const art: IdentifyResponse = {
  title: 'Guernica', artist: 'Pablo Picasso', year: '1937', country: 'Spain', style: 'Cubism',
  description: long, funFact: 'It toured the world before returning to Spain in 1981.', sources: [],
  deepAnalysis: {
    historicalContext: long, technicalAnalysis: 'Monochrome oil on canvas.', symbolism: 'The bull and the horse.',
    curiosities: ['It was kept at MoMA for decades.', 'Dora Maar photographed it in progress.', 'It is 7.8 metres wide.'],
  },
} as any;

const renderPage = () => render(
  <ScanPage
    page={{ key: 's1', data: art, imageUrl: null, scanId: 's1' }}
    language="en" userContext={{ name: 'Ana', email: 'a@x', persona: 'guide' }}
    isDeepAnalyzing={false} hasSelfie={false}
    onOpenChat={vi.fn()} onOpenQuiz={vi.fn()} onShare={vi.fn()} onScanAnother={vi.fn()}
  />,
);

describe('scan page: concise text in cards, one button shape', () => {
  it('every action is a centered pill of the same height', () => {
    renderPage();
    for (const name of [/Chat with/, /Quiz: 3 questions/, /Share/, /Scan Another/i]) {
      const b = screen.getByRole('button', { name });
      expect(b.className).toContain('justify-center');
      expect(b.className).toContain('min-h-[52px]');
      expect(b.className).toContain('rounded-full');
    }
  });

  it('shows the description as a single short paragraph', () => {
    renderPage();
    expect(screen.queryByText(/second paragraph that should never show/i)).toBeNull();
    const p = screen.getAllByText(/Painted in 1937/)[0];
    expect(p.textContent!.length).toBeLessThanOrEqual(320);
  });

  it('presents the analysis as cards: did you know, numbered curiosities, context, technique, symbolism', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Did you know/i })).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Historical context/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Technique/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Symbolism/i })).toBeTruthy();
  });
});
