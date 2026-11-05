/**
 * Narration timeline: line up Gemini Live's output transcription with its audio,
 * using only what the Live session already streams (text chunks + PCM audio).
 *
 * Measured on recorded sessions (see scratch/narration): Live streams audio at
 * about real time and its text runs ~1–4 s ahead of the audio that speaks it,
 * so text arrival alone is not a usable clock. Instead each sentence start is
 * estimated from the speaking rate and then snapped to the nearest pause the
 * PauseDetector finds in the audio itself.
 */

export interface NarrationSentence {
  text: string;
  /** Character offset of the sentence in the full transcript. */
  charStart: number;
  /** Seconds from the start of the narration audio. */
  start: number;
}

/** Average speaking rate of the Live voices in our recordings (chars/second). */
export const DEFAULT_CHARS_PER_SEC = 15;
const FRAME_SEC = 0.01;
/** Silence that can separate two sentences. */
const MIN_PAUSE_SEC = 0.2;

/** Split a transcript into sentences, keeping Spanish ¿ ¡ with the sentence they open. */
export function splitSentences(full: string): { text: string; charStart: number }[] {
  const out: { text: string; charStart: number }[] = [];
  const re = /[^.!?…]+(?:[.!?…]+["'”»)]*|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(full)) !== null) {
    const raw = m[0];
    if (!raw.trim()) {
      if (m.index === re.lastIndex) re.lastIndex++;
      continue;
    }
    const lead = raw.length - raw.trimStart().length;
    out.push({ text: raw.trim(), charStart: m.index + lead });
  }
  return out;
}

export interface PauseOnset {
  /** Seconds where speech resumes after a pause. */
  time: number;
  /** Length of the preceding silence, in seconds. */
  gap: number;
}

/**
 * Streaming pause detector over 16-bit mono PCM. Feed chunks as they arrive;
 * `onsets` lists every place speech resumes after a silence of MIN_PAUSE_SEC.
 */
export class PauseDetector {
  readonly onsets: PauseOnset[] = [];
  private readonly frameSize: number;
  private carry: number[] = [];
  private frames = 0;
  private silentRun = 0;
  private maxRms = 0;
  private seenVoice = false;

  constructor(private readonly sampleRate = 24000) {
    this.frameSize = Math.round(sampleRate * FRAME_SEC);
  }

  /** Total audio fed so far, in seconds. */
  get duration(): number {
    return (this.frames * this.frameSize + this.carry.length) / this.sampleRate;
  }

  /**
   * Audio time up to which every pause has been reported. A silence still running at
   * the end of the received audio has no onset yet, so this is where that silence began.
   */
  get settledSec(): number {
    return this.silentRun > 0 ? (this.frames - this.silentRun) * FRAME_SEC : this.frames * FRAME_SEC;
  }

  push(pcm: Int16Array): void {
    const samples = this.carry.length ? [...this.carry, ...pcm] : Array.from(pcm);
    let i = 0;
    for (; i + this.frameSize <= samples.length; i += this.frameSize) {
      let sum = 0;
      for (let j = i; j < i + this.frameSize; j++) {
        const v = samples[j] / 32768;
        sum += v * v;
      }
      this.frame(Math.sqrt(sum / this.frameSize));
    }
    this.carry = samples.slice(i);
  }

  private frame(rms: number): void {
    this.maxRms = Math.max(this.maxRms * 0.9995, rms);
    const voiced = rms > Math.max(0.01, 0.12 * this.maxRms);
    const t = this.frames * FRAME_SEC;
    if (voiced) {
      if (!this.seenVoice) {
        this.onsets.push({ time: t, gap: Infinity });
        this.seenVoice = true;
      } else if (this.silentRun * FRAME_SEC >= MIN_PAUSE_SEC) {
        this.onsets.push({ time: t, gap: this.silentRun * FRAME_SEC });
      }
      this.silentRun = 0;
    } else if (this.seenVoice) {
      this.silentRun++;
    }
    this.frames++;
  }
}

/**
 * Give each sentence a start time: the first one starts at the first speech
 * onset; each next one is expected `chars / rate` after the previous start and
 * snaps to the nearest pause onset in a window around that estimate.
 */
/** Streaming commit threshold, chosen on recorded Live sessions (scratch eval_stream). */
export const STREAM_COMMIT_SCORE = 0.25;
/**
 * Streaming rate shrinkage: voices run 0.75–1.35× the default rate on long sentences; a quarter
 * of the measured rate fixes fast voices without letting one odd sentence swing the estimate.
 */
export const STREAM_RATE_BLEND = 0.25;
/**
 * In recorded sessions 62 of 83 sentence-end pauses last ≥ 0.4 s against 14 of 53 comma pauses;
 * a long pause may sit further from the estimate (the voice speeds up within a narration).
 */
export const STREAM_LONG_PAUSE = { gap: 0.45, tolerance: 0.35 };

export function alignSentences(
  sentences: { text: string; charStart: number }[],
  onsets: PauseOnset[],
  charsPerSec = DEFAULT_CHARS_PER_SEC,
  /**
   * While streaming: audio time up to which every pause is known (PauseDetector.settledSec).
   * A sentence whose start pause may still arrive stays pending (start = Infinity).
   */
  audioReceivedSec = Infinity,
  /** While streaming, a pause within this fraction of the previous sentence's duration of the estimate commits at once. */
  commitScore = STREAM_COMMIT_SCORE,
  /** While streaming, weight of this voice's measured rate against `charsPerSec` (shrinkage). */
  rateBlend = STREAM_RATE_BLEND,
  /** While streaming, long pauses (sentence ends far more often than commas) get a wider tolerance. */
  longPause: { gap: number; tolerance: number } = STREAM_LONG_PAUSE,
): NarrationSentence[] {
  const result: NarrationSentence[] = [];
  const first = onsets[0]?.time ?? 0;
  let prevStart = first;
  let used = 0;
  sentences.forEach((s, k) => {
    if (prevStart === Infinity) {
      result.push({ ...s, start: Infinity });
      return;
    }
    if (k === 0) {
      result.push({ ...s, start: first });
      return;
    }
    const prev = sentences[k - 1];
    // While streaming, blend the default rate with this voice's rate measured on the sentences
    // already placed (greeting excluded: it is spoken slower). Shrinkage keeps one odd sentence
    // from swinging the estimate.
    let rate = charsPerSec;
    if (rateBlend > 0 && audioReceivedSec !== Infinity && k >= 3 && prevStart - result[1].start > 2) {
      const measured = Math.min(22, Math.max(10, (prev.charStart - sentences[1].charStart) / (prevStart - result[1].start)));
      rate = charsPerSec * (1 - rateBlend) + measured * rateBlend;
    }
    const prevDur = prev.text.length / rate;
    const est = prevStart + prevDur;
    // Where the previous sentence's own commas should fall: pauses there are not sentence ends
    const commaTimes: number[] = [];
    for (let c = 0; c < prev.text.length - 1; c++) {
      if (',;:'.includes(prev.text[c])) commaTimes.push(prevStart + (c + 1) / rate);
    }
    const penalty = (o: PauseOnset) =>
      commaTimes.some((ct) => Math.abs(o.time - o.gap - ct) < 0.45) ? 0.6 : 0;
    // Short greetings ("¡Hola, Ana!") are spoken slower than the average rate: allow absolute slack
    const lo = prevStart + prevDur * 0.55;
    const hi = prevStart + prevDur * 1.6 + 0.8;
    const score = (o: PauseOnset) => Math.abs(o.time - o.gap - est) - Math.min(o.gap, 0.8) * 0.5 + penalty(o);
    // The streaming rule holds for the whole stream (not just while the window is still
    // arriving): switching rules once audio passes `hi` would move a caption already shown.
    const streaming = audioReceivedSec !== Infinity;
    const windowOpen = hi > audioReceivedSec;
    const goodMatch = (o: PauseOnset) => {
      const d = Math.abs(o.time - o.gap - est);
      return d <= commitScore * prevDur + 0.15 || (o.gap >= longPause.gap && d <= longPause.tolerance * prevDur + 0.15);
    };
    let best: PauseOnset | null = null;
    let bestScore = Infinity;
    for (let i = used + 1; i < onsets.length; i++) {
      const o = onsets[i];
      if (o.time - o.gap < lo) continue;
      if (o.time > hi) break;
      // Streaming: received audio runs only ~0.3 s ahead of playback (more after a pause or a
      // network burst), so we cannot wait for certainty. The first pause that is a good match
      // (within `commitScore` of the previous sentence's duration of the estimate: rate errors
      // grow with length) wins, so the choice does not depend on how much audio is buffered
      // and a caption never jumps back once shown.
      if (streaming && goodMatch(o)) { best = o; bestScore = -Infinity; break; }
      // Prefer pauses close to the estimate; longer pauses win small differences.
      // The previous sentence should END near `est`, i.e. where this pause begins.
      const sc = score(o);
      if (sc < bestScore) { best = o; bestScore = sc; }
    }
    if (streaming) {
      // Without a good match, commit only when no pause still to arrive could score better:
      // a future pause begins at or after `audioReceivedSec`, so its score is at least
      // max(0, received − est) − 0.4 (the largest gap bonus). Otherwise stay pending.
      const futureBound = Math.max(0, audioReceivedSec - est) - 0.4;
      if (windowOpen && (!best || bestScore > futureBound)) {
        result.push({ ...s, start: Infinity });
        prevStart = Infinity;
        return;
      }
    }
    const start = best ? best.time : est;
    if (best) used = onsets.indexOf(best);
    result.push({ ...s, start });
    prevStart = start;
  });
  return result;
}

/** Speaking rate calibrated on a finished narration (falls back to the default). */
export function calibratedRate(totalChars: number, onsets: PauseOnset[], speechEndSec: number): number {
  const start = onsets[0]?.time ?? 0;
  const dur = speechEndSec - start;
  if (dur < 2 || totalChars < 20) return DEFAULT_CHARS_PER_SEC;
  return Math.min(22, Math.max(10, totalChars / dur));
}

/** Index of the sentence being spoken at audio time `t` (-1 before the first). */
export function sentenceAt(sentences: NarrationSentence[], t: number): number {
  let idx = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].start <= t + 0.05) idx = i;
    else break;
  }
  return idx;
}

/** Encode 16-bit mono PCM as a WAV file. */
export function encodeWav(pcm: Int16Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  write(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); write(8, 'WAVE');
  write(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  write(36, 'data'); v.setUint32(40, pcm.byteLength, true);
  const out = new Uint8Array(44 + pcm.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 44);
  return out;
}
