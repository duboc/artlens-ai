import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audio Concurrency — Visibility Cleanup', () => {
  const appFile = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
  const narrationFile = fs.readFileSync(path.resolve(__dirname, '../hooks/useNarration.ts'), 'utf-8');
  const geminiLiveFile = fs.readFileSync(path.resolve(__dirname, '../hooks/useGeminiLive.ts'), 'utf-8');

  describe('App.tsx', () => {
    it('calls narration.stop() at the top of processImageAnalysis before network calls', () => {
      // narration.stop() should appear before identifyArtwork
      const stopIndex = appFile.indexOf('narration.stop()');
      const identifyIndex = appFile.indexOf('identifyArtwork(');
      expect(stopIndex).toBeGreaterThan(-1);
      expect(identifyIndex).toBeGreaterThan(-1);
      expect(stopIndex).toBeLessThan(identifyIndex);
    });

    it('has a visibilitychange listener that stops narration when page is hidden', () => {
      expect(appFile).toContain('visibilitychange');
      expect(appFile).toContain('document.hidden');
      expect(appFile).toContain('narration.stop()');
    });
  });

  describe('useNarration', () => {
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
