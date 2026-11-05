import { describe, it, expect } from 'vitest';
import { displayName, artworkKey, rankEntries, shuffleQuestion, validQuestion, isIdentified } from '../server/services/game';
import { MUSEUMS } from '../museums';
import { POINTS, QUIZ_MAX_POINTS } from '../museums/scoring';

describe('game helpers', () => {
  it('shows first name + last initial on the ranking', () => {
    expect(displayName('Ana García López')).toBe('Ana L.');
    expect(displayName('  luis  ')).toBe('luis');
    expect(displayName('')).toBe('Visitor');
  });

  it('treats accents, case and punctuation as the same artwork', () => {
    expect(artworkKey('La botella de anís', 'Juan Gris')).toBe(artworkKey('LA BOTELLA DE ANIS', 'juan gris'));
    expect(artworkKey('Guernica', 'Pablo Picasso')).not.toBe(artworkKey('Guernica', 'Someone Else'));
  });

  it('does not award unidentified artworks', () => {
    expect(isIdentified({ title: 'Unknown Artwork' })).toBe(false);
    expect(isIdentified({ title: 'Obra desconocida' })).toBe(false);
    expect(isIdentified({ title: 'Guernica' })).toBe(true);
  });

  it('uses competition ranking for ties', () => {
    const ranked = rankEntries([{ points: 300 }, { points: 200 }, { points: 200 }, { points: 50 }]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it('shuffles options while keeping the right answer', () => {
    const q = { question: 'Who?', options: ['A', 'B', 'C', 'D'], answerIndex: 2, explanation: 'C.' };
    let seed = 0.37;
    const random = () => { seed = (seed * 9301 + 49297) % 233280 / 233280; return seed; };
    for (let i = 0; i < 20; i++) {
      const s = shuffleQuestion(q, random);
      expect(s.options[s.answerIndex]).toBe('C');
      expect([...s.options].sort()).toEqual(['A', 'B', 'C', 'D']);
    }
  });

  it('rejects malformed quiz questions', () => {
    expect(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], answerIndex: 0, explanation: '' })).toBe(true);
    expect(validQuestion({ question: 'Q', options: ['a', 'b', 'c'], answerIndex: 0, explanation: '' })).toBe(false);
    expect(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], answerIndex: 4, explanation: '' })).toBe(false);
    expect(validQuestion({ question: '', options: ['a', 'b', 'c', 'd'], answerIndex: 1, explanation: '' })).toBe(false);
  });

  it('caps a quiz at three correct answers plus the perfect bonus', () => {
    expect(QUIZ_MAX_POINTS).toBe(POINTS.quizCorrect * 3 + POINTS.quizPerfectBonus);
  });
});

describe('museum missions', () => {
  it.each(Object.values(MUSEUMS))('$id has complete, unique missions', (museum) => {
    expect(museum.missions.length).toBeGreaterThan(0);
    const ids = museum.missions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of museum.missions) {
      expect(m.title.en && m.title.es && m.title.pt).toBeTruthy();
      expect(m.hint.en && m.hint.es && m.hint.pt).toBeTruthy();
      expect(m.criterion.length).toBeGreaterThan(10);
      expect(m.points).toBeGreaterThan(0);
    }
  });

  it('gives the Reina Sofía its own eight missions, including Guernica', () => {
    const ids = MUSEUMS['reina-sofia'].missions.map((m) => m.id);
    expect(ids).toHaveLength(8);
    expect(ids).toContain('guernica');
  });
});
