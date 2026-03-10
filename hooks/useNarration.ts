import { useState, useRef, useCallback } from 'react';
import { IdentifyResponse, Language, Persona } from '../types';
import { base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';

interface UseNarrationReturn {
  isGenerating: boolean;
  isPlaying: boolean;
  script: string | null;
  generate: (artData: IdentifyResponse, persona: Persona, language: Language, userName: string) => Promise<void>;
  stop: () => void;
}

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

export const useNarration = (): UseNarrationReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [script, setScript] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptRef = useRef<string>('');

  const stop = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    scheduledSourcesRef.current.forEach(s => {
      try { s.stop(); } catch {}
    });
    scheduledSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (outputContextRef.current) {
      outputContextRef.current.close().catch(() => {});
      outputContextRef.current = null;
    }
    setIsPlaying(false);
    setIsGenerating(false);
  }, []);

  const generate = useCallback(async (
    artData: IdentifyResponse,
    persona: Persona,
    language: Language,
    userName: string,
  ) => {
    // Stop any existing narration
    stop();
    setScript(null);
    setIsGenerating(true);
    transcriptRef.current = '';

    const voice = VOICE_MAP[persona] || 'Zephyr';
    const personaDesc = PERSONA_DESCRIPTIONS[persona] || PERSONA_DESCRIPTIONS.guide;
    const langName = LANGUAGE_NAMES[language] || 'English';

    const systemInstruction = `You are the museum guide for the Google Cloud AI Leadership Academy visit to the Museu Nacional d'Art de Catalunya (MNAC).

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

    try {
      // Create AudioContext for playback
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/live`;

      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            setup: {
              model: 'gemini-live-2.5-flash-native-audio',
              generation_config: {
                response_modalities: ['AUDIO'],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: { voice_name: voice },
                  },
                },
              },
              system_instruction: {
                parts: [{ text: systemInstruction }],
              },
              output_audio_transcription: {},
            },
          }));
        };

        ws.onmessage = async (event) => {
          let msg: any;
          try {
            msg = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
          } catch {
            return;
          }

          // Setup complete → send narration prompt
          if (msg.setupComplete !== undefined) {
            setIsGenerating(false);

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
            resolve();
            return;
          }

          const serverContent = msg.serverContent;
          if (!serverContent) return;

          // Capture transcription for script handoff
          if (serverContent.outputTranscription?.text) {
            transcriptRef.current += serverContent.outputTranscription.text;
          }

          // Play audio chunks as they arrive
          const audioPart = serverContent.modelTurn?.parts?.find((p: any) => p.inlineData?.data);
          const base64Audio = audioPart?.inlineData?.data;
          if (base64Audio && outputContextRef.current) {
            const outCtx = outputContextRef.current;
            if (outCtx.state === 'suspended') {
              try { await outCtx.resume(); } catch {}
            }
            setIsPlaying(true);
            try {
              const audioData = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, outCtx, 24000, 1);
              const currentTime = outCtx.currentTime;
              if (nextStartTimeRef.current < currentTime) nextStartTimeRef.current = currentTime;

              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;

              scheduledSourcesRef.current.add(source);
              source.onended = () => {
                scheduledSourcesRef.current.delete(source);
                if (scheduledSourcesRef.current.size === 0) setIsPlaying(false);
              };
            } catch (e) {
              console.error('[narration] Decode/play error:', e);
            }
          }

          // Turn complete → save transcript and close
          if (serverContent.turnComplete) {
            if (transcriptRef.current) {
              setScript(transcriptRef.current);
            }
            // Close WebSocket after narration is done (audio still plays from buffer)
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
          }
        };

        ws.onclose = () => {
          // Don't stop playback — audio buffers continue playing
          wsRef.current = null;
        };

        ws.onerror = (err) => {
          console.error('[narration] WebSocket error:', err);
          setIsGenerating(false);
          reject(new Error('Narration connection failed'));
        };
      });
    } catch (err) {
      console.error('[narration] Failed:', err);
      setIsGenerating(false);
    }
  }, [stop]);

  return { isGenerating, isPlaying, script, generate, stop };
};
