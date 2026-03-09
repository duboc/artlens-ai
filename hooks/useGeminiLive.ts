import { useState, useRef, useCallback, useEffect } from 'react';
import { IdentifyResponse, Language, UserContext } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

interface AudioBlob {
  data: string;
  mimeType: string;
}

interface UseGeminiLiveReturn {
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  activeMicLabel: string | null;
  connect: (context: IdentifyResponse, language: Language, user: UserContext, explanationLength?: 'brief' | 'detailed') => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  sendTextInput: (text: string) => Promise<void>;
  stopNarration: () => void;
  error: string | null;
  setOnTranscript: (callback: (text: string, isUser: boolean, isFinal: boolean) => void) => void;
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

  const connect = useCallback(async (contextData: IdentifyResponse, language: Language, user: UserContext, explanationLength: 'brief' | 'detailed' = 'detailed') => {
    setError(null);
    try {
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      if (track) {
          setActiveMicLabel(track.label || "Default Microphone");
          track.enabled = false;
          setIsMuted(true);
      }

      let langInstruction = 'English';
      if (language === 'pt') langInstruction = 'Portuguese';
      if (language === 'es') langInstruction = 'Spanish';

      let personaInstruction = '';
      switch (user.persona) {
        case 'academic':
            personaInstruction = "You are a distinguished, detail-oriented Historian. Use formal language, discuss techniques deeply, and reference historical parallels.";
            break;
        case 'blogger':
            personaInstruction = "You are an energetic, trendy Influencer. Use exciting, accessible language, slang, and focus on what makes this piece 'viral' or cool. Keep it fast-paced.";
            break;
        case 'guide':
        default:
            personaInstruction = "You are a warm, friendly Classic Guide. Be accessible, encouraging, and helpful. Use simple metaphors.";
            break;
      }

      let deepContext = "";
      if (contextData.deepAnalysis) {
        deepContext = `
        DEEP ANALYSIS DATA:
        - Historical Context: ${contextData.deepAnalysis.historicalContext}
        - Symbolism: ${contextData.deepAnalysis.symbolism}
        - Curiosities: ${contextData.deepAnalysis.curiosities?.join('; ') || ''}

        Use these details to provide unique insights and specific "did you know" facts when relevant.
        `;
      }

      const lengthInstruction = explanationLength === 'brief'
        ? 'Keep your responses concise — 2-3 sentences maximum. Be direct and focused.'
        : 'Provide detailed, rich explanations. Share context, stories, and connections.';

      const systemInstruction = `
          ${personaInstruction}
          Your name is ArtLens. Address the user as "${user.name}".
          ${lengthInstruction}

          The user is looking at:
          Title: ${contextData.title}
          Artist: ${contextData.artist}
          Year: ${contextData.year}
          Description: ${contextData.description}
          ${deepContext}

          Goal: Have a spoken conversation in ${langInstruction}.
          IMPORTANT: Speak ONLY in ${langInstruction}.
      `;

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
                    prebuilt_voice_config: { voice_name: 'Kore' },
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
            console.log('Live Session Connected');
            setIsConnected(true);

            if (inputContextRef.current) {
              const ctx = inputContextRef.current;
              const source = ctx.createMediaStreamSource(stream);
              const processor = ctx.createScriptProcessor(4096, 1, 1);

              processor.onaudioprocess = (e) => {
                if (audioStreamRef.current?.getAudioTracks()[0]?.enabled) {
                  const inputData = e.inputBuffer.getChannelData(0);
                  const blob: AudioBlob = createPcmBlob(inputData);
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                      realtime_input: {
                        media_chunks: [{ mime_type: blob.mimeType, data: blob.data }],
                      },
                    }));
                  }
                }
              };

              source.connect(processor);
              processor.connect(ctx.destination);
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

          const base64Audio = serverContent.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio && outputContextRef.current) {
            const ctx = outputContextRef.current;
            setIsSpeaking(true);
            try {
              const audioData = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
              const currentTime = ctx.currentTime;
              if (nextStartTimeRef.current < currentTime) nextStartTimeRef.current = currentTime;

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;

              scheduledSourcesRef.current.add(source);
              source.onended = () => {
                scheduledSourcesRef.current.delete(source);
                if (scheduledSourcesRef.current.size === 0) setIsSpeaking(false);
              };
            } catch (e) { console.error("Audio Decode Error", e); }
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
