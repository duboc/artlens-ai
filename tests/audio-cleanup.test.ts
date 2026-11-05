import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audio Concurrency — Visibility Cleanup', () => {
  const appFile = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
  const narrationFile = fs.readFileSync(path.resolve(__dirname, '../hooks/useNarration.ts'), 'utf-8');
  const geminiLiveFile = fs.readFileSync(path.resolve(__dirname, '../hooks/useGeminiLive.ts'), 'utf-8');

  describe('App.tsx', () => {
    it('silences narration at the top of processImageAnalysis, before network calls', () => {
      // detach() goes silent at once; a still-streaming narration finishes in the background
      // (useNarration hands it off) so the previous scan keeps its narration
      const start = appFile.indexOf('const processImageAnalysis');
      const detachIndex = appFile.indexOf('narration.detach()', start);
      const identifyIndex = appFile.indexOf('identifyArtwork(', start);
      expect(detachIndex).toBeGreaterThan(-1);
      expect(identifyIndex).toBeGreaterThan(-1);
      expect(detachIndex).toBeLessThan(identifyIndex);
    });

    it('has a visibilitychange listener that pauses the live narration when the page is hidden', () => {
      expect(appFile).toContain('visibilitychange');
      expect(appFile).toContain('document.hidden');
      expect(appFile).toContain('narration.backgrounded()');
    });

    it('closing the result does not kill a narration that is still streaming', () => {
      const start = appFile.indexOf('const handleReset');
      const end = appFile.indexOf('};', start);
      const body = appFile.slice(start, end);
      expect(body).toContain('narration.detach()');
      expect(body).not.toContain('narration.stop()');
    });
  });

  describe('useNarration', () => {
    it('hands a detached, still-streaming narration to a background collector before a new one', () => {
      const gen = narrationFile.indexOf('const generate = useCallback');
      expect(narrationFile.indexOf('handOffDetached();', gen)).toBeGreaterThan(gen);
      expect(narrationFile.indexOf('handOffDetached();', gen)).toBeLessThan(narrationFile.indexOf('stop();', gen));
    });

    it('has a cleanup useEffect on unmount', () => {
      // Should have useEffect with stop() in return
      expect(narrationFile).toContain('useEffect');
      expect(narrationFile).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{\s*stop\(\)/);
    });

    it('imports useEffect', () => {
      expect(narrationFile).toMatch(/import\s*\{[^}]*useEffect[^}]*\}/);
    });
  });

  describe('useGeminiLive', () => {
    it('has a visibilitychange listener that disconnects when page is hidden', () => {
      expect(geminiLiveFile).toContain('visibilitychange');
      expect(geminiLiveFile).toContain('document.hidden');
    });

    it('checks for active WebSocket before cleaning up on visibility change', () => {
      // Should only cleanup when there's an active connection
      expect(geminiLiveFile).toContain('document.hidden && wsRef.current');
    });

    it('has cleanup on unmount', () => {
      expect(geminiLiveFile).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{\s*cleanup\(\)/);
    });
  });
});
