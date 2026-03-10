import { useState, useRef, useCallback, useEffect } from 'react';
import { IdentifyResponse, Language, UserContext, Persona } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

const VOICE_MAP: Record<string, string> = {
  guide: 'Zephyr',
  academic: 'Kore',
  blogger: 'Puck',
};

interface AudioBlob {
  data: string;
  mimeType: string;
}

interface UseGeminiLiveReturn {
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  activeMicLabel: string | null;
  connect: (context: IdentifyResponse, language: Language, user: UserContext, explanationLength?: 'brief' | 'detailed', narrationScript?: string | null) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  sendTextInput: (text: string) => Promise<void>;
  stopNarration: () => void;
  error: string | null;
  setOnTranscript: (callback: (text: string, isUser: boolean, isFinal: boolean) => void) => void;
}

// Pre-warm AudioContexts from a user gesture so they start in 'running' state.
// Call this from a click handler BEFORE connect() runs in a useEffect.
let preWarmedInput: AudioContext | null = null;
let preWarmedOutput: AudioContext | null = null;

export function preWarmAudio() {
  preWarmedInput = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  preWarmedOutput = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  console.log('[audio] Pre-warmed AudioContexts:', preWarmedInput.state, preWarmedOutput.state);
}

export const useGeminiLive = (): UseGeminiLiveReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [activeMicLabel, setActiveMicLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTranscriptRef = useRef<((text: string, isUser: boolean, isFinal: boolean) => void) | null>(null);

  const setOnTranscript = useCallback((callback: (text: string, isUser: boolean, isFinal: boolean) => void) => {
    onTranscriptRef.current = callback;
  }, []);

  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const currentModelTranscriptRef = useRef<string>('');
  const currentUserTranscriptRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    scheduledSourcesRef.current.clear();
    setIsConnected(false);
    setIsSpeaking(false);
    setActiveMicLabel(null);
    currentModelTranscriptRef.current = '';
    currentUserTranscriptRef.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  const ensureAudioContext = useCallback(async () => {
    if (inputContextRef.current?.state === 'suspended') {
      await inputContextRef.current.resume();
    }
    if (outputContextRef.current?.state === 'suspended') {
      await outputContextRef.current.resume();
    }
  }, []);

  const toggleMute = useCallback(async () => {
    await ensureAudioContext();

    setIsMuted(prev => {
      const nextState = !prev;
      if (audioStreamRef.current) {
        audioStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !nextState;
        });
      }
      return nextState;
    });
  }, [ensureAudioContext]);

  const connect = useCallback(async (contextData: IdentifyResponse, language: Language, user: UserContext, explanationLength: 'brief' | 'detailed' = 'detailed', narrationScript?: string | null) => {
    setError(null);
    try {
      // Use pre-warmed AudioContexts if available (created in user gesture context)
      if (preWarmedInput && preWarmedOutput) {
        inputContextRef.current = preWarmedInput;
        outputContextRef.current = preWarmedOutput;
        console.log('[audio] Using pre-warmed contexts:', preWarmedInput.state, preWarmedOutput.state);
        preWarmedInput = null;
        preWarmedOutput = null;
      } else {
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        console.log('[audio] Created new contexts:', inputContextRef.current.state, outputContextRef.current.state);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      if (track) {
          setActiveMicLabel(track.label || "Default Microphone");
          track.enabled = false;
          setIsMuted(true);
      }

      const voice = VOICE_MAP[user.persona] || 'Zephyr';

      let langInstruction = 'English';
      if (language === 'pt') langInstruction = 'Portuguese';
      if (language === 'es') langInstruction = 'Spanish';

      let personaInstruction = '';
      switch (user.persona) {
        case 'academic':
            personaInstruction = "You are a distinguished, detail-oriented Historian. Use formal language, discuss techniques deeply, and reference historical parallels. You bring the rigor of an art history professor but keep it engaging.";
            break;
        case 'blogger':
            personaInstruction = "You are an energetic, trendy Influencer. Use exciting, accessible language, slang, and focus on what makes this piece 'viral' or cool. Keep it fast-paced and shareable.";
            break;
        case 'guide':
        default:
            personaInstruction = "You are a warm, friendly Classic Guide. Be accessible, encouraging, and helpful. Use simple metaphors and storytelling to bring art to life.";
            break;
      }

      let deepContext = "";
      if (contextData.deepAnalysis) {
        deepContext = `
        DEEP ANALYSIS DATA:
        - Historical Context: ${contextData.deepAnalysis.historicalContext}
        - Technical Analysis: ${contextData.deepAnalysis.technicalAnalysis}
        - Symbolism: ${contextData.deepAnalysis.symbolism}
        - Curiosities: ${contextData.deepAnalysis.curiosities?.join('; ') || ''}

        Weave these details naturally into conversation. Share curiosities as "did you know" moments.
        `;
      }

      const lengthInstruction = explanationLength === 'brief'
        ? 'Keep your responses concise — 2-3 sentences maximum. Be direct and focused.'
        : 'Provide rich, engaging explanations. Share stories, connections, and vivid details that bring the artwork to life.';

      const systemInstruction = `
          ${personaInstruction}
          You are the museum guide for the Google Cloud AI Leadership Academy visit to the Museu Nacional d'Art de Catalunya (MNAC). Address the user as "${user.name}".
          ${lengthInstruction}

          MUSEUM CONTEXT:
          You are guiding visitors at the Museu Nacional d'Art de Catalunya (MNAC), housed in the Palau Nacional on Montjuïc hill in Barcelona. MNAC holds the world's most important collection of Romanesque murals (transferred from Pyrenean churches), alongside outstanding Gothic altarpieces, Renaissance and Baroque works, and a celebrated Modern Art collection featuring Catalan Modernisme masters (Gaudí, Casas, Rusiñol, Mir). The Thyssen-Bornemisza collection adds European breadth.

          When relevant:
          - Connect the artwork to MNAC's broader collection and Catalan cultural identity.
          - Suggest related works the visitor might find nearby in the museum.
          - Mention the physical space — "in the next gallery," "upstairs in the Modern Art wing."
          - Speak as if walking alongside the visitor: "if you look closely," "notice how the artist..."

          THE ARTWORK:
          Title: ${contextData.title}
          Artist: ${contextData.artist}
          Year: ${contextData.year}
          Style: ${contextData.style}
          Description: ${contextData.description}
          ${deepContext}
          ${narrationScript ? `
          PRIOR NARRATION:
          The visitor has already heard this narration about the artwork (via TTS):
          "${narrationScript}"
          Do NOT repeat this introduction. Continue naturally from where the narration left off — add new insights, go deeper, or respond to questions.
          ` : ''}

          BEHAVIOR:
          - Speak naturally and conversationally — you are a companion, not a textbook.
          - Open with something that hooks attention: a surprising fact, a question, or a vivid detail.
          - When the visitor asks about something you don't know, say so honestly and suggest what they could explore instead.
          - Speak ONLY in ${langInstruction}.
      `;

      // Capture contexts locally so the onmessage closure isn't affected by
      // cleanup() nullifying the refs (e.g. React StrictMode double-mount).
      const localInputCtx = inputContextRef.current;
      const localOutputCtx = outputContextRef.current;

      // Build WebSocket URL — Vite proxies /ws/* to the backend
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/live`;

      // Return a promise that resolves when setupComplete is received,
      // matching the old SDK behavior where ai.live.connect() was awaitable
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          const setupMessage = {
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
              input_audio_transcription: {},
              output_audio_transcription: {},
            },
          };
          ws.send(JSON.stringify(setupMessage));
        };

        ws.onmessage = async (event) => {
          let msg: any;
          try {
            msg = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
          } catch {
            return;
          }

          // setupComplete → mark as connected, start audio pipeline, resolve promise
          if (msg.setupComplete !== undefined) {
            console.log('[audio] Live Session Connected, outputCtx:', localOutputCtx.state);
            setIsConnected(true);

            if (localInputCtx) {
              const source = localInputCtx.createMediaStreamSource(stream);
              const processor = localInputCtx.createScriptProcessor(4096, 1, 1);

              processor.onaudioprocess = (e) => {
                if (audioStreamRef.current?.getAudioTracks()[0]?.enabled) {
                  const inputData = e.inputBuffer.getChannelData(0);
                  const blob: AudioBlob = createPcmBlob(inputData);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      realtime_input: {
                        media_chunks: [{ mime_type: blob.mimeType, data: blob.data }],
                      },
                    }));
                  }
                }
              };

              source.connect(processor);
              processor.connect(localInputCtx.destination);
              sourceNodeRef.current = source;
              scriptProcessorRef.current = processor;
            }

            resolve();
            return;
          }

          // Handle server content messages
          const serverContent = msg.serverContent;
          if (!serverContent) return;

          if (serverContent.outputTranscription?.text) {
            currentModelTranscriptRef.current += serverContent.outputTranscription.text;
            if (onTranscriptRef.current) onTranscriptRef.current(currentModelTranscriptRef.current, false, false);
          }

          if (serverContent.inputTranscription?.text) {
            currentUserTranscriptRef.current += serverContent.inputTranscription.text;
            if (onTranscriptRef.current) onTranscriptRef.current(currentUserTranscriptRef.current, true, false);
          }

          if (serverContent.turnComplete) {
            if (currentModelTranscriptRef.current && onTranscriptRef.current) {
              onTranscriptRef.current(currentModelTranscriptRef.current, false, true);
              currentModelTranscriptRef.current = '';
            }
            if (currentUserTranscriptRef.current && onTranscriptRef.current) {
              onTranscriptRef.current(currentUserTranscriptRef.current, true, true);
              currentUserTranscriptRef.current = '';
            }
          }

          // Find audio part (may not be the first part)
          const audioPart = serverContent.modelTurn?.parts?.find((p: any) => p.inlineData?.data);
          const base64Audio = audioPart?.inlineData?.data;
          if (base64Audio && localOutputCtx) {
            // Resume suspended AudioContext if needed
            if (localOutputCtx.state === 'suspended') {
              try { await localOutputCtx.resume(); } catch {}
            }
            setIsSpeaking(true);
            try {
              const audioData = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, localOutputCtx, 24000, 1);
              const currentTime = localOutputCtx.currentTime;
              if (nextStartTimeRef.current < currentTime) nextStartTimeRef.current = currentTime;

              const source = localOutputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(localOutputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;

              scheduledSourcesRef.current.add(source);
              source.onended = () => {
                scheduledSourcesRef.current.delete(source);
                if (scheduledSourcesRef.current.size === 0) setIsSpeaking(false);
              };
            } catch (e) { console.error("[audio] Decode/play error:", e); }
          }

          if (serverContent.interrupted) {
            scheduledSourcesRef.current.forEach(s => s.stop());
            scheduledSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsSpeaking(false);
            currentModelTranscriptRef.current = '';
          }
        };

        ws.onclose = (_event) => {
          console.log('Live Session Closed');
          setIsConnected(false);
          cleanup();
        };

        ws.onerror = (err) => {
          console.error('Live Session Error', err);
          setError("Connection error");
          cleanup();
          reject(new Error("WebSocket connection failed"));
        };
      });

    } catch (err: any) {
      console.error("Failed to connect", err);
      setError(err.message);
      cleanup();
    }
  }, [cleanup]);

  const sendTextInput = useCallback(async (text: string) => {
    await ensureAudioContext();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          client_content: {
            turns: [{ role: 'user', parts: [{ text: text }] }],
            turn_complete: true,
          },
        }));
      } catch (e) { console.error("Failed to send text", e); }
    }
  }, [ensureAudioContext]);

  const stopNarration = useCallback(() => {
    // Immediately flush audio playback queue
    scheduledSourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    scheduledSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
    currentModelTranscriptRef.current = '';
  }, []);

  return { isConnected, isSpeaking, isMuted, activeMicLabel, connect, disconnect: cleanup, toggleMute, sendTextInput, stopNarration, error, setOnTranscript };
};
