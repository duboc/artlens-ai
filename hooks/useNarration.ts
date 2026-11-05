import { useState, useRef, useCallback, useEffect } from 'react';
import { IdentifyResponse, Language, Persona } from '../types';
import { base64ToUint8Array } from '../utils/audioUtils';
import { getMuseum, guideIntro } from '../museums';
import {
  NarrationSentence,
  PauseDetector,
  alignSentences,
  calibratedRate,
  encodeWav,
  sentenceAt,
  splitSentences,
  DEFAULT_CHARS_PER_SEC,
} from '../utils/narrationTimeline';

/**
 * Narration engine for the post-scan intro.
 *
 * - First play streams from Gemini Live through Web Audio; pause/resume suspend
 *   the AudioContext, and the text is lined up with the audio by
 *   utils/narrationTimeline (only data the Live session already streams).
 * - Everything received is kept locally, so "listen again" plays the buffered
 *   audio through an <audio> element: no new Live session, and the OS shows
 *   lock-screen controls (Media Session API).
 * - Saved narrations (history) play the same way from their stored WAV.
 */

export type NarrationMode = 'listen' | 'read';
export type NarrationStatus = 'idle' | 'connecting' | 'streaming' | 'finished' | 'error';

export interface NarrationRecording {
  pcm: Int16Array;
  script: string;
  sentences: NarrationSentence[];
  durationSec: number;
}

/** A narration persisted with a scan. */
export interface SavedNarration {
  audioUrl: string;
  script: string;
  sentences: NarrationSentence[];
  durationSec: number;
}

export interface NarrationMeta {
  title: string;
  artist: string;
  artworkUrl?: string | null;
}

export interface UseNarrationReturn {
  status: NarrationStatus;
  /** Scan the engine currently holds ('current' for the live scan, or a history scan id). */
  sourceKey: string | null;
  isGenerating: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  script: string | null;
  sentences: NarrationSentence[];
  activeSentence: number;
  /** Playback position in seconds, read on demand (not React state: no re-render per frame). */
  getPosition: () => number;
  duration: number;
  mode: NarrationMode;
  setMode: (mode: NarrationMode) => void;
  generate: (artData: IdentifyResponse, persona: Persona, language: Language, userName: string) => Promise<NarrationRecording | null>;
  pause: () => void;
  resume: () => void;
  replay: (fromSec?: number) => void;
  playSaved: (key: string, saved: SavedNarration, meta: NarrationMeta) => void;
  stop: () => void;
  /**
   * The visitor closed the result: go silent at once but let the Live stream finish in the
   * background so the narration (audio + text) is still saved with the scan.
   */
  detach: () => void;
  /**
   * The page went to the background (screen locked, app switched). Saved audio keeps playing
   * with lock-screen controls; the live stream (Web Audio, no lock-screen controls) pauses so
   * it can be resumed.
   */
  backgrounded: () => void;
}

const SAMPLE_RATE = 24000;
const MODE_KEY = 'artlens_narrationMode';

const VOICE_MAP: Record<string, string> = {
  guide: 'Zephyr',
  academic: 'Kore',
  blogger: 'Puck',
};

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  guide: 'You are warm, friendly, and approachable — like a knowledgeable friend showing someone around.',
  academic: 'You are scholarly, precise, and authoritative — a respected art historian sharing expertise.',
  blogger: 'You are energetic, casual, and entertaining — you make art feel exciting and relevant.',
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
};

// ─── Shared audio context (unlocked on the scan gesture) ────────────────────

let sharedCtx: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    sharedCtx = new Ctor({ sampleRate: SAMPLE_RATE });
  }
  return sharedCtx;
}

/** Call synchronously inside a user gesture (e.g. the shutter tap) so iOS lets audio play later. */
export function unlockAudio(): void {
  try {
    const ctx = audioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { /* no Web Audio */ }
}

function readMode(): NarrationMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'read' ? 'read' : 'listen';
  } catch {
    return 'listen';
  }
}

function pcmChunkToBuffer(ctx: AudioContext, pcm: Int16Array): AudioBuffer {
  const buffer = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
  return buffer;
}

function concat(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export const useNarration = (): UseNarrationReturn => {
  const [status, setStatus] = useState<NarrationStatus>('idle');
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [sentences, setSentences] = useState<NarrationSentence[]>([]);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [duration, setDuration] = useState(0);
  const [mode, setModeState] = useState<NarrationMode>(readMode);

  const wsRef = useRef<WebSocket | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  /** Closed by the visitor while streaming: keep receiving silently, never play. */
  const detachedRef = useRef(false);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartRef = useRef(0);
  const startAtRef = useRef<number | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const detectorRef = useRef<PauseDetector | null>(null);
  const transcriptRef = useRef('');
  const sentencesRef = useRef<NarrationSentence[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const engineRef = useRef<'live' | 'element' | null>(null);
  const rafRef = useRef<number | null>(null);
  const metaRef = useRef<NarrationMeta | null>(null);
  const modeRef = useRef<NarrationMode>(mode);
  const resolveRef = useRef<((rec: NarrationRecording | null) => void) | null>(null);
  const sessionRef = useRef(0);

  // ─── Position clock ───────────────────────────────────────────────────────

  const currentPosition = useCallback((): number => {
    if (engineRef.current === 'element' && audioElRef.current) return audioElRef.current.currentTime;
    if (engineRef.current === 'live' && startAtRef.current !== null && sharedCtx) {
      return Math.max(0, sharedCtx.currentTime - startAtRef.current);
    }
    return 0;
  }, []);

  const tick = useCallback(() => {
    const pos = currentPosition();
    const idx = modeRef.current === 'read' ? -1 : sentenceAt(sentencesRef.current, pos);
    setActiveSentence((prev) => (prev === idx ? prev : idx));
    if (typeof window !== 'undefined') {
      const dbg = (window as any).__artlensNarration;
      if (dbg && idx !== dbg.lastIdx) {
        dbg.lastIdx = idx;
        dbg.highlights.push({ idx, position: pos, start: sentencesRef.current[idx]?.start ?? null, at: Math.round(performance.now()) });
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [currentPosition]);

  const startClock = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopClock = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  // ─── Media Session (lock-screen controls) ─────────────────────────────────

  const handlersRef = useRef<{ pause: () => void; resume: () => void; stop: () => void }>({ pause: () => {}, resume: () => {}, stop: () => {} });

  const updateMediaSession = useCallback((state: 'playing' | 'paused' | 'none') => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const meta = metaRef.current;
    if (meta && state !== 'none' && typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.artist,
        album: getMuseum().shortName,
        artwork: meta.artworkUrl ? [{ src: meta.artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }
    ms.playbackState = state;
    try {
      ms.setActionHandler('play', () => handlersRef.current.resume());
      ms.setActionHandler('pause', () => handlersRef.current.pause());
      ms.setActionHandler('stop', () => handlersRef.current.stop());
    } catch { /* unsupported action */ }
  }, []);

  // ─── Stop everything ──────────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    sourcesRef.current.forEach((s) => { try { s.stop(); } catch {} });
    sourcesRef.current.clear();
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.onended = null;
    }
    if (sharedCtx && sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    stopClock();
    setIsPlaying(false);
    setIsPaused(false);
  }, [stopClock]);

  const stop = useCallback(() => {
    sessionRef.current++;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    stopPlayback();
    engineRef.current = null;
    startAtRef.current = null;
    nextStartRef.current = 0;
    resolveRef.current?.(null);
    resolveRef.current = null;
    setStatus((s) => (s === 'connecting' || s === 'streaming' ? 'idle' : s));
    updateMediaSession('none');
  }, [stopPlayback, updateMediaSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [stop]);

  // ─── Pause / resume ───────────────────────────────────────────────────────

  const pause = useCallback(() => {
    if (engineRef.current === 'live' && sharedCtx) {
      sharedCtx.suspend().catch(() => {});
    } else if (engineRef.current === 'element') {
      audioElRef.current?.pause();
    } else {
      return;
    }
    setIsPaused(true);
    setIsPlaying(false);
    updateMediaSession('paused');
  }, [updateMediaSession]);

  const playElement = useCallback((url: string, fromSec: number) => {
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
      audioElRef.current.preload = 'auto';
    }
    const el = audioElRef.current;
    if (el.src !== url) el.src = url;
    engineRef.current = 'element';
    el.onended = () => {
      setIsPlaying(false);
      setIsPaused(false);
      stopClock();
      setActiveSentence(-1);
      updateMediaSession('none');
    };
    const start = () => {
      try { el.currentTime = fromSec; } catch {}
      el.play().then(() => {
        setIsPlaying(true);
        setIsPaused(false);
        startClock();
        updateMediaSession('playing');
      }).catch((err) => console.error('[narration] play failed:', err));
    };
    if (el.readyState >= 1) start();
    else el.addEventListener('loadedmetadata', start, { once: true });
  }, [startClock, stopClock, updateMediaSession]);

  const resume = useCallback(() => {
    if (engineRef.current === 'live' && sharedCtx) {
      sharedCtx.resume().catch(() => {});
      setIsPaused(false);
      setIsPlaying(true);
      updateMediaSession('playing');
    } else if (engineRef.current === 'element' && audioElRef.current) {
      audioElRef.current.play().then(() => {
        setIsPaused(false);
        setIsPlaying(true);
        startClock();
        updateMediaSession('playing');
      }).catch(() => {});
    }
  }, [startClock, updateMediaSession]);

  /** Play the buffered narration again from `fromSec` without contacting the server. */
  const replay = useCallback((fromSec = 0) => {
    if (!blobUrlRef.current) {
      if (!chunksRef.current.length) return;
      const wav = encodeWav(concat(chunksRef.current), SAMPLE_RATE);
      blobUrlRef.current = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    }
    sourcesRef.current.forEach((s) => { try { s.stop(); } catch {} });
    sourcesRef.current.clear();
    if (sharedCtx && sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    playElement(blobUrlRef.current, fromSec);
  }, [playElement]);

  const setMode = useCallback((next: NarrationMode) => {
    modeRef.current = next;
    setModeState(next);
    try { localStorage.setItem(MODE_KEY, next); } catch {}
    if (gainRef.current && !detachedRef.current) gainRef.current.gain.value = next === 'read' ? 0 : 1;
    if (next === 'read') {
      if (engineRef.current === 'element') audioElRef.current?.pause();
      setActiveSentence(-1);
      setIsPlaying(false);
      updateMediaSession('none');
    }
  }, [updateMediaSession]);

  handlersRef.current = {
    pause,
    resume: () => (isPaused ? resume() : replay(0)),
    stop,
  };

  // ─── Saved narrations (history) ───────────────────────────────────────────

  const playSaved = useCallback((key: string, saved: SavedNarration, meta: NarrationMeta) => {
    stop();
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    chunksRef.current = [];
    metaRef.current = meta;
    sentencesRef.current = saved.sentences;
    setSourceKey(key);
    setScript(saved.script);
    setSentences(saved.sentences);
    setDuration(saved.durationSec);
    setStatus('finished');
    if (modeRef.current === 'read') setMode('listen');
    playElement(saved.audioUrl, 0);
  }, [playElement, setMode, stop]);

  // ─── Live generation ──────────────────────────────────────────────────────

  const realign = useCallback((final: boolean) => {
    const det = detectorRef.current;
    if (!det) return;
    const parts = splitSentences(transcriptRef.current);
    const rate = final ? calibratedRate(transcriptRef.current.length, det.onsets, det.duration) : DEFAULT_CHARS_PER_SEC;
    const aligned = alignSentences(parts, det.onsets, rate, final ? Infinity : det.settledSec);
    const prev = sentencesRef.current;
    sentencesRef.current = aligned;
    // Audio chunks arrive every ~160 ms; re-render only when the text or a start time changed
    const same = prev.length === aligned.length && prev.every((p, i) => p.text === aligned[i].text && p.start === aligned[i].start);
    if (!same) setSentences(aligned);
  }, []);

  /**
   * A new scan is starting while the previous narration (already closed by the visitor) is still
   * streaming: hand its connection to a silent background collector that finishes receiving,
   * aligns the captions and resolves the original promise, so that scan still gets its narration.
   */
  const handOffDetached = useCallback(() => {
    const ws = wsRef.current;
    const resolve = resolveRef.current;
    const det = detectorRef.current;
    if (!detachedRef.current || !ws || !resolve || !det) return;
    const chunks = chunksRef.current;
    let transcript = transcriptRef.current;
    // Detach from the engine so stop() neither closes this socket nor resolves the promise
    wsRef.current = null;
    resolveRef.current = null;
    detectorRef.current = null;
    let done = false;
    const end = (rec: NarrationRecording | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      resolve(rec);
    };
    const timer = setTimeout(() => end(null), 60_000);
    ws.onmessage = async (event) => {
      let msg: any;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
      } catch {
        return;
      }
      const sc = msg.serverContent;
      if (!sc) return;
      if (sc.outputTranscription?.text) transcript += sc.outputTranscription.text;
      for (const part of sc.modelTurn?.parts || []) {
        const data = part.inlineData?.data;
        if (!data) continue;
        const bytes = base64ToUint8Array(data);
        const pcm = new Int16Array(new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2)));
        chunks.push(pcm);
        det.push(pcm);
      }
      if (sc.turnComplete) {
        const pcm = concat(chunks);
        const sentences = alignSentences(splitSentences(transcript), det.onsets, calibratedRate(transcript.length, det.onsets, det.duration));
        end({ pcm, script: transcript, sentences, durationSec: pcm.length / SAMPLE_RATE });
      }
    };
    ws.onerror = () => end(null);
    ws.onclose = () => end(null);
  }, []);

  const generate = useCallback(async (
    artData: IdentifyResponse,
    persona: Persona,
    language: Language,
    userName: string,
  ): Promise<NarrationRecording | null> => {
    handOffDetached();
    stop();
    const session = ++sessionRef.current;
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    chunksRef.current = [];
    detectorRef.current = new PauseDetector(SAMPLE_RATE);
    transcriptRef.current = '';
    sentencesRef.current = [];
    metaRef.current = { title: artData.title, artist: artData.artist };
    setSourceKey('current');
    setScript(null);
    setSentences([]);
    setActiveSentence(-1);
    setDuration(0);
    setStatus('connecting');
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
      (window as any).__artlensNarration = { highlights: [], lastIdx: -1, wsOpened: 0, ctx: () => sharedCtx?.state, sentences: () => sentencesRef.current,
        element: () => { const el = audioElRef.current; return el ? { src: el.src, paused: el.paused, currentTime: el.currentTime, error: el.error?.code ?? null } : null; } };
    }

    const voice = VOICE_MAP[persona] || 'Zephyr';
    const personaDesc = PERSONA_DESCRIPTIONS[persona] || PERSONA_DESCRIPTIONS.guide;
    const langName = LANGUAGE_NAMES[language] || 'English';
    const museum = getMuseum();
    const systemInstruction = `${guideIntro(museum)}${museum.guideContext ? `\n\n${museum.guideContext}` : ''}

Personality: ${personaDesc}

You will narrate a short introduction (2-3 sentences, about 15-20 seconds) for a visitor who just scanned an artwork. You must:
1. Greet the visitor by their first name
2. Identify the artwork naturally (title, artist)
3. Share one compelling detail — a story, hidden meaning, technique, or surprising fact
4. End with a brief invitation to continue the conversation

Rules:
- Speak entirely in ${langName}
- Be natural and conversational
- Match the personality exactly
- Keep it tight — this is a 15-20 second intro, not a lecture`;

    let ctx: AudioContext;
    try {
      ctx = audioContext();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    } catch (err) {
      console.error('[narration] No audio context:', err);
      setStatus('error');
      return null;
    }
    const gain = ctx.createGain();
    detachedRef.current = false;
    gain.gain.value = modeRef.current === 'read' ? 0 : 1;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    engineRef.current = 'live';
    startAtRef.current = null;
    nextStartRef.current = 0;

    return new Promise<NarrationRecording | null>((resolve) => {
      resolveRef.current = resolve;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/live`);
      wsRef.current = ws;
      const dbg = (window as any).__artlensNarration;
      if (dbg) dbg.wsOpened++;

      const finish = (rec: NarrationRecording | null) => {
        if (resolveRef.current === resolve) resolveRef.current = null;
        resolve(rec);
      };

      /** Sends the narration request once the session is set up (also used after a hand-off). */
      const sendPrompt = () => {
                  ws.send(JSON.stringify({
                    client_content: {
                      turns: [{
                        role: 'user',
                        parts: [{
                          text: `Visitor name: ${userName}

        Artwork:
        - Title: ${artData.title}
        - Artist: ${artData.artist}
        - Year: ${artData.year || 'Unknown'}
        - Style: ${artData.style || ''}
        - Description: ${artData.description || ''}
        - Fun fact: ${artData.funFact || ''}

        Begin your narration now.`,
                        }],
                      }],
                      turn_complete: true,
                    },
                  }));
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            // model is injected server-side (MODEL_LIVE)
            generation_config: {
              response_modalities: ['AUDIO'],
              speech_config: { voice_config: { prebuilt_voice_config: { voice_name: voice } } },
            },
            system_instruction: { parts: [{ text: systemInstruction }] },
            output_audio_transcription: {},
          },
        }));
      };

      ws.onmessage = async (event) => {
        if (session !== sessionRef.current) return;
        let msg: any;
        try {
          msg = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
        } catch {
          return;
        }

        if (msg.setupComplete !== undefined) {
          setStatus('streaming');
          sendPrompt();
          return;
        }

        const sc = msg.serverContent;
        if (!sc) return;
        let changed = false;

        if (sc.outputTranscription?.text) {
          transcriptRef.current += sc.outputTranscription.text;
          setScript(transcriptRef.current);
          changed = true;
        }

        for (const part of sc.modelTurn?.parts || []) {
          const data = part.inlineData?.data;
          if (!data) continue;
          const bytes = base64ToUint8Array(data);
          const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
          const copy = new Int16Array(pcm);
          chunksRef.current.push(copy);
          detectorRef.current?.push(copy);
          changed = true;

          const buffer = pcmChunkToBuffer(ctx, copy);
          const now = ctx.currentTime;
          if (startAtRef.current === null) {
            startAtRef.current = now + 0.05;
            nextStartRef.current = startAtRef.current;
          }
          if (nextStartRef.current < now) {
            // Underrun: shift the clock so text stays aligned with what is heard
            startAtRef.current += now - nextStartRef.current;
            nextStartRef.current = now;
          }
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(gain);
          src.start(nextStartRef.current);
          nextStartRef.current += buffer.duration;
          sourcesRef.current.add(src);
          src.onended = () => {
            sourcesRef.current.delete(src);
            if (sourcesRef.current.size === 0 && !wsRef.current) {
              setIsPlaying(false);
              stopClock();
              setActiveSentence(-1);
              updateMediaSession('none');
            }
          };
          if (modeRef.current === 'listen' && ctx.state === 'running' && !detachedRef.current) {
            setIsPlaying(true);
            startClock();
            updateMediaSession('playing');
          }
        }

        if (changed) realign(false);

        if (sc.turnComplete) {
          realign(true);
          if (wsRef.current) {
            try { wsRef.current.close(); } catch {}
            wsRef.current = null;
          }
          setStatus('finished');
          const pcm = concat(chunksRef.current);
          setDuration(pcm.length / SAMPLE_RATE);
          finish({
            pcm,
            script: transcriptRef.current,
            sentences: sentencesRef.current,
            durationSec: pcm.length / SAMPLE_RATE,
          });
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
      };

      ws.onerror = (err) => {
        console.error('[narration] WebSocket error:', err);
        setStatus('error');
        finish(null);
      };
    });
  }, [handOffDetached, realign, startClock, stop, stopClock, updateMediaSession]);

  const detach = useCallback(() => {
    if (engineRef.current === 'live' && wsRef.current) {
      detachedRef.current = true;
      if (gainRef.current) gainRef.current.gain.value = 0;
      if (sharedCtx?.state === 'suspended') sharedCtx.resume().catch(() => {});
      stopClock();
      setIsPlaying(false);
      setIsPaused(false);
      setActiveSentence(-1);
      setSourceKey(null);
      updateMediaSession('none');
      return;
    }
    stop();
  }, [stop, stopClock, updateMediaSession]);

  const backgrounded = useCallback(() => {
    if (engineRef.current === 'live' && sharedCtx?.state === 'running') pause();
  }, [pause]);

  return {
    status,
    sourceKey,
    isGenerating: status === 'connecting',
    isPlaying,
    isPaused,
    script,
    sentences,
    activeSentence,
    getPosition: currentPosition,
    duration,
    mode,
    setMode,
    generate,
    pause,
    resume,
    replay,
    playSaved,
    stop,
    detach,
    backgrounded,
  };
};
