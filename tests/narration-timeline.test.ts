import { describe, it, expect } from 'vitest';
import fixture from './fixtures/live-narration-sessions.json';
import {
  splitSentences, alignSentences, calibratedRate, sentenceAt, encodeWav, PauseDetector, DEFAULT_CHARS_PER_SEC,
} from '../utils/narrationTimeline';

type Session = (typeof fixture.sessions)[number];
const onsetsOf = (s: Session) => s.onsets.map((o) => ({ time: o.time, gap: o.gap ?? Infinity }));

describe('narration timeline', () => {
  it('splits sentences and keeps Spanish ¿ ¡ with the sentence they open', () => {
    const parts = splitSentences('¡Hola, Ana! Estás frente al Guernica. ¿Sabías que es de 1937? Vamos.');
    expect(parts.map((p) => p.text)).toEqual(['¡Hola, Ana!', 'Estás frente al Guernica.', '¿Sabías que es de 1937?', 'Vamos.']);
    expect(parts[1].charStart).toBe(12);
  });

  it('detects pauses in streamed PCM', () => {
    const sr = 24000;
    const tone = (sec: number) => Int16Array.from({ length: sr * sec }, (_, i) => Math.round(8000 * Math.sin(i / 8)));
    const silence = (sec: number) => new Int16Array(sr * sec);
    const det = new PauseDetector(sr);
    [tone(1), silence(0.5), tone(1)].forEach((chunk) => {
      for (let i = 0; i < chunk.length; i += 3840) det.push(chunk.subarray(i, i + 3840));
    });
    expect(det.onsets[0].time).toBeCloseTo(0, 1);
    expect(det.onsets[1].time).toBeCloseTo(1.5, 1);
    expect(det.onsets[1].gap).toBeGreaterThan(0.4);
    expect(det.duration).toBeCloseTo(2.5, 2);
  });

  describe('on 63 recorded Gemini Live sessions (3 languages, 3 voices; 10 captured in the app; 18 later stops without a greeting)', () => {
    /** Fraction of sentences within 300 ms of the reference, with the misses for the failure message. */
    function score(errors: { label: string; k: number; ms: number }[]) {
      const misses = errors.filter((e) => Math.abs(e.ms) > 300);
      return { rate: 1 - misses.length / errors.length, misses: misses.map((m) => `${m.label}#${m.k}: ${m.ms} ms`) };
    }

    it('the finished narration places ≥ 98% of sentences within 300 ms of the reference', () => {
      const errors: { label: string; k: number; ms: number }[] = [];
      for (const s of fixture.sessions) {
        const onsets = onsetsOf(s);
        const final = alignSentences(splitSentences(s.transcript), onsets, calibratedRate(s.transcript.length, onsets, s.durationSec));
        expect(final.length).toBe(s.referenceStarts.length);
        s.referenceStarts.forEach((ref, k) => { if (ref !== null) errors.push({ label: s.label, k, ms: Math.round((final[k].start - ref) * 1000) }); });
      }
      const { rate, misses } = score(errors);
      expect(errors.length).toBeGreaterThanOrEqual(215);
      expect(rate, misses.join(', ')).toBeGreaterThanOrEqual(0.98);
    });

    /**
     * Replays the stream with the real arrival time of every chunk, schedules playback like
     * useNarration (first chunk + 50 ms, sequential, underruns shift the clock) and records the
     * playback position at which each sentence first gets highlighted (never = failure).
     */
    function replay(s: Session): (number | null)[] {
      const all = onsetsOf(s);
      type Audio = { t: number; dur: number; settled: number; known: number };
      const audio: Audio[] = [];
      const texts: { t: number; text: string }[] = [];
      for (const c of s.stream as (number | string)[][]) {
        if (c[1] === 0) audio.push({ t: c[0] as number, dur: c[2] as number, settled: c[3] as number, known: c[4] as number });
        else texts.push({ t: c[0] as number, text: c[2] as string });
      }
      let next = 0.05, from = 0;
      const sched = audio.map((a) => {
        if (next < a.t) next = a.t; // underrun
        const e = { play: next, from, dur: a.dur };
        next += a.dur;
        from += a.dur;
        return e;
      });
      const posAt = (w: number) => {
        let p = 0;
        for (const e of sched) { if (w < e.play) break; p = e.from + Math.min(w - e.play, e.dur); }
        return p;
      };
      const first: (number | null)[] = s.referenceStarts.map(() => null);
      let ai = -1, ti = 0, text = '';
      for (let w = 0; w <= next + 0.2; w += 0.01) {
        while (ai + 1 < audio.length && audio[ai + 1].t <= w) ai++;
        while (ti < texts.length && texts[ti].t <= w) text += texts[ti++].text;
        const known = ai >= 0 ? audio[ai] : { settled: 0, known: 0 };
        // After the last chunk (turnComplete) the app realigns with the calibrated rate
        const done = ai === audio.length - 1 && ti === texts.length;
        const aligned = done
          ? alignSentences(splitSentences(text), all, calibratedRate(text.length, all, s.durationSec))
          : alignSentences(splitSentences(text), all.slice(0, known.known), DEFAULT_CHARS_PER_SEC, known.settled);
        const idx = sentenceAt(aligned, posAt(w));
        for (let k = 0; k <= idx && k < first.length; k++) if (first[k] === null) first[k] = posAt(w);
      }
      return first;
    }

    it('live captions switch within 300 ms of the voice for ≥ 98% of sentences while streaming', () => {
      const errors: { label: string; k: number; ms: number }[] = [];
      for (const s of fixture.sessions) {
        const first = replay(s);
        s.referenceStarts.forEach((ref, k) => {
          if (ref === null) return;
          // never highlighted counts as a miss
          errors.push({ label: s.label, k, ms: first[k] === null ? 99999 : Math.round((first[k]! - ref) * 1000) });
        });
      }
      const { rate, misses } = score(errors);
      expect(rate, misses.join(', ')).toBeGreaterThanOrEqual(0.98);
    });

    it('holds on the sessions captured inside the app (real prompt, real browser)', () => {
      const errors: { label: string; k: number; ms: number }[] = [];
      for (const s of fixture.sessions.filter((x) => x.set === 'in-app')) {
        const first = replay(s);
        s.referenceStarts.forEach((ref, k) => { if (ref !== null) errors.push({ label: s.label, k, ms: first[k] === null ? 99999 : Math.round((first[k]! - ref) * 1000) }); });
      }
      expect(errors.length).toBeGreaterThanOrEqual(38);
      expect(score(errors).rate, score(errors).misses.join(', ')).toBeGreaterThanOrEqual(0.95);
    });

    it('holds on later stops of a visit (no greeting, long opening sentence), including 10 held-out sessions', () => {
      const errors: { label: string; k: number; ms: number }[] = [];
      for (const s of fixture.sessions.filter((x) => x.set === 'continuation' || x.set === 'continuation-holdout')) {
        const first = replay(s);
        s.referenceStarts.forEach((ref, k) => { if (ref !== null) errors.push({ label: s.label, k, ms: first[k] === null ? 99999 : Math.round((first[k]! - ref) * 1000) }); });
      }
      expect(errors.length).toBeGreaterThanOrEqual(50);
      expect(score(errors).rate, score(errors).misses.join(', ')).toBeGreaterThanOrEqual(0.94);
    });

    it('keeps upcoming sentences pending until their pause has streamed in', () => {
      const s = fixture.sessions[0];
      const onsets = onsetsOf(s).filter((o) => o.time <= 3);
      const partial = alignSentences(splitSentences(s.transcript), onsets, DEFAULT_CHARS_PER_SEC, 3);
      expect(Number.isFinite(partial[0].start)).toBe(true);
      expect(partial[partial.length - 1].start).toBe(Infinity);
    });

    it('does not take an early comma pause for the start of a long sentence (session7 at 11.7 s)', () => {
      const s = fixture.sessions.find((x) => x.label === 'session7')!;
      const onsets = onsetsOf(s).filter((o) => o.time <= 12);
      const partial = alignSentences(splitSentences(s.transcript), onsets, DEFAULT_CHARS_PER_SEC, 12);
      expect(partial[3].start).toBe(Infinity);
    });
  });

  it('finds the sentence being spoken', () => {
    const sents = [{ text: 'a', charStart: 0, start: 0 }, { text: 'b', charStart: 2, start: 2 }, { text: 'c', charStart: 4, start: Infinity }];
    expect(sentenceAt(sents, 1)).toBe(0);
    expect(sentenceAt(sents, 2.5)).toBe(1);
    expect(sentenceAt(sents, 99)).toBe(1);
  });

  it('encodes a valid mono 24 kHz WAV', () => {
    const wav = encodeWav(new Int16Array([0, 1000, -1000]), 24000);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint32(40, true)).toBe(6);
    expect(wav.length).toBe(50);
  });
});
