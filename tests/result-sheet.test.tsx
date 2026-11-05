import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { NarrationPanel } from '../components/result/NarrationPanel';
import { ResultSheet } from '../components/result/ResultSheet';
import type { UseNarrationReturn } from '../hooks/useNarration';
import type { IdentifyResponse } from '../types';

const sentences = [
  { text: '¡Hola, Ana!', charStart: 0, start: 0 },
  { text: 'Estás frente al Guernica.', charStart: 12, start: 1.1 },
  { text: '¿Quieres saber más?', charStart: 38, start: Infinity },
];

function engine(over: Partial<UseNarrationReturn> = {}): UseNarrationReturn {
  return {
    status: 'streaming', sourceKey: 'current', isGenerating: false, isPlaying: true, isPaused: false,
    script: sentences.map((s) => s.text).join(' '), sentences, activeSentence: 1, getPosition: () => 1.5, duration: 6,
    mode: 'listen', setMode: vi.fn(), generate: vi.fn(), pause: vi.fn(), resume: vi.fn(), replay: vi.fn(),
    playSaved: vi.fn(), stop: vi.fn(), backgrounded: vi.fn(), ...over,
  };
}

const meta = { title: 'Guernica', artist: 'Pablo Picasso' };

describe('NarrationPanel', () => {
  it('shows the narration text and highlights the sentence being spoken', () => {
    render(<NarrationPanel pageKey="current" engine={engine()} meta={meta} language="en" />);
    const active = document.querySelector('[aria-current="true"]');
    expect(active?.textContent?.trim()).toBe('Estás frente al Guernica.');
    expect(screen.getByText(/Quieres saber/)).toBeTruthy();
  });

  it('pauses, resumes and replays without a new session', () => {
    const e1 = engine();
    const { rerender } = render(<NarrationPanel pageKey="current" engine={e1} meta={meta} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause narration' }));
    expect(e1.pause).toHaveBeenCalled();

    const e2 = engine({ isPlaying: false, isPaused: true });
    rerender(<NarrationPanel pageKey="current" engine={e2} meta={meta} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume narration' }));
    expect(e2.resume).toHaveBeenCalled();

    const e3 = engine({ isPlaying: false, isPaused: false, status: 'finished', activeSentence: -1 });
    rerender(<NarrationPanel pageKey="current" engine={e3} meta={meta} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Listen again' }));
    expect(e3.replay).toHaveBeenCalledWith(0);
    expect(e3.generate).not.toHaveBeenCalled();
  });

  it('read-only mode shows the text without a highlight and remembers the choice through setMode', () => {
    const e = engine({ mode: 'read' });
    render(<NarrationPanel pageKey="current" engine={e} meta={meta} language="es" />);
    expect(document.querySelector('[aria-current="true"]')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Escuchar' }));
    expect(e.setMode).toHaveBeenCalledWith('listen');
  });

  it('switches Listen / Read only with the arrow keys (radiogroup)', () => {
    const e = engine({ mode: 'listen' });
    render(<NarrationPanel pageKey="current" engine={e} meta={meta} language="en" />);
    const group = screen.getByRole('radiogroup', { name: 'How to follow the guide' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(e.setMode).toHaveBeenCalledWith('read');
    expect(screen.getByRole('radio', { name: 'Listen' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('radio', { name: 'Read only' }).getAttribute('tabindex')).toBe('-1');
  });

  it('shows a busy spinner on the play button while the guide is getting ready', () => {
    render(<NarrationPanel pageKey="current" engine={engine({ status: 'connecting', isPlaying: false, script: null, sentences: [] })} meta={meta} language="en" />);
    const play = screen.getByRole('button', { name: 'Play narration' });
    expect(play.getAttribute('aria-busy')).toBe('true');
    expect(play.querySelector('.animate-spin')).toBeTruthy();
  });

  it('plays a saved narration for an earlier scan', () => {
    const e = engine({ sourceKey: 'current' });
    const saved = { audioUrl: '/api/images/users/u/narrations/s1.wav', script: 'Hola.', sentences: [{ text: 'Hola.', charStart: 0, start: 0 }], durationSec: 2 };
    render(<NarrationPanel pageKey="s1" engine={e} saved={saved} meta={meta} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play narration' }));
    expect(e.playSaved).toHaveBeenCalledWith('s1', saved, meta);
  });
});

describe('ResultSheet', () => {
  const art: IdentifyResponse = {
    title: 'Guernica', artist: 'Pablo Picasso', year: '1937', country: 'Spain', style: 'Cubism',
    description: 'Mural.', funFact: '', sources: [],
  };
  const pages = [
    { key: 'current', data: art, imageUrl: null, scanId: 'scan-1' },
    { key: 'old-1', data: { ...art, title: 'Un mundo', artist: 'Ángeles Santos' }, imageUrl: null, scanId: 'old-1' },
  ];
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafCallbacks.push(cb); return rafCallbacks.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  const flushFrames = (ms = 2000) => {
    let now = performance.now();
    for (let t = 0; t < ms; t += 16) {
      const cbs = rafCallbacks; rafCallbacks = [];
      now += 16;
      act(() => cbs.forEach((cb) => cb(now)));
    }
  };

  const props = (onClosed = vi.fn()) => ({
    pages, language: 'en' as const, userContext: { name: 'Ana', email: 'a@x', persona: 'guide' as const },
    isDeepAnalyzing: false, hasSelfie: false, animateIn: false, onClosed, onShare: vi.fn(),
  });

  it('adds a history entry so the system back gesture closes it', () => {
    const before = history.length;
    const onClosed = vi.fn();
    render(<ResultSheet {...props(onClosed)} />);
    expect(history.length).toBe(before + 1);
    expect(history.state).toEqual({ artlens: 'sheet' });
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    flushFrames();
    expect(onClosed).toHaveBeenCalled();
  });

  it('survives a StrictMode remount without closing itself or stacking history entries', async () => {
    const before = history.length;
    const onClosed = vi.fn();
    const go = vi.spyOn(history, 'go');
    render(<React.StrictMode><ResultSheet {...props(onClosed)} /></React.StrictMode>);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    flushFrames();
    expect(go).not.toHaveBeenCalled();
    expect(history.length).toBe(before + 1);
    expect(onClosed).not.toHaveBeenCalled();
    go.mockRestore();
  });

  it('shows the position among earlier scans and closes from the close button', () => {
    const onClosed = vi.fn();
    render(<ResultSheet {...props(onClosed)} />);
    expect(screen.getByText('Scan 1 of 2')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Guernica' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    flushFrames();
    expect(onClosed).toHaveBeenCalled();
  });
});
