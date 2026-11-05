import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HUDOverlay } from '../components/HUDOverlay';
import { ScanPage } from '../components/result/ScanPage';
import type { IdentifyResponse } from '../types';

const hud = (over: Partial<React.ComponentProps<typeof HUDOverlay>> = {}) => (
  <HUDOverlay isScanning={false} onScan={vi.fn()} hasResult={false} language="en" points={0} onPointsClick={vi.fn()} {...over}>
    {null}
  </HUDOverlay>
);

describe('camera only + earlier captures', () => {
  it('offers no way to upload a photo from the device', () => {
    const { container } = render(hud({ lastCapture: { imageUrl: '/a.jpg', title: 'Guernica', count: 3 }, onOpenCaptures: vi.fn() }));
    expect(container.querySelector('input[type=file]')).toBeNull();
    expect(screen.queryByRole('button', { name: /upload/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tap to identify' })).toBeTruthy();
  });

  it('shows the last capture next to the shutter and reopens earlier scans', () => {
    const onOpen = vi.fn();
    render(hud({ lastCapture: { imageUrl: '/a.jpg', title: 'Guernica', count: 3 }, onOpenCaptures: onOpen }));
    const thumb = screen.getByRole('button', { name: /Your scans \(3\)/ });
    expect(thumb.textContent).toContain('3');
    fireEvent.click(thumb);
    expect(onOpen).toHaveBeenCalled();
  });

  it('hides the capture button before the first scan', () => {
    render(hud({ lastCapture: null, onOpenCaptures: vi.fn() }));
    expect(screen.queryByRole('button', { name: /Your scans/ })).toBeNull();
  });

  const art: IdentifyResponse = { title: 'Guernica', artist: 'Pablo Picasso', year: '1937', country: 'Spain', style: 'Cubism', description: '', funFact: '', sources: [] };
  const page = (activity?: any) => (
    <ScanPage
      page={{ key: 's1', data: art, imageUrl: null, scanId: 's1', activity }}
      language="en" userContext={{ name: 'Ana', email: 'a@x', persona: 'guide' }}
      isDeepAnalyzing={false} hasSelfie={false}
      onOpenChat={vi.fn()} onOpenQuiz={vi.fn()} onShare={vi.fn()} onScanAnother={vi.fn()}
    />
  );

  it('shows what was already done with an earlier artwork', () => {
    render(page({ chatMessages: 4, quiz: { answered: 1, correct: 1, total: 3 } }));
    expect(screen.getByRole('button', { name: /Continue the chat.*4 messages/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resume the quiz.*1 right · 1\/3/ })).toBeTruthy();
  });

  it('starts fresh when nothing was done yet', () => {
    render(page(undefined));
    expect(screen.getByRole('button', { name: /Chat with/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Quiz: 3 questions/ })).toBeTruthy();
  });

  it('offers a review once the quiz is finished', () => {
    render(page({ chatMessages: 0, quiz: { answered: 3, correct: 2, total: 3 } }));
    expect(screen.getByRole('button', { name: /Review the quiz.*2 right · 3\/3/ })).toBeTruthy();
  });
});
