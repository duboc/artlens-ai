import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { IdentifyResponse, Language, UserContext } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

interface UseGeminiLiveReturn {
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  activeMicLabel: string | null;
  connect: (context: IdentifyResponse, language: Language, user: UserContext) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  sendTextInput: (text: string) => Promise<void>;
  error: string | null;
  setOnTranscript: (callback: (text: string, isUser: boolean, isFinal: boolean) => void) => void;
}

export const useGeminiLive = (): UseGeminiLiveReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted
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
  
  const sessionRef = useRef<any>(null);
  const currentModelTranscriptRef = useRef<string>('');
  const currentUserTranscriptRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
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

  // Helper to ensure audio context is running (fixes mobile suspension)
  const ensureAudioContext = useCallback(async () => {
    if (inputContextRef.current?.state === 'suspended') {
      await inputContextRef.current.resume();
    }
    if (outputContextRef.current?.state === 'suspended') {
      await outputContextRef.current.resume();
    }
  }, []);

  const toggleMute = useCallback(async () => {
    // Resume audio context on user interaction (unmute)
    await ensureAudioContext();

    setIsMuted(prev => {
      const nextState = !prev;
      if (audioStreamRef.current) {
        audioStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !nextState; // Enabled if NOT muted
        });
      }
      return nextState;
    });
  }, [ensureAudioContext]);

  const connect = useCallback(async (contextData: IdentifyResponse, language: Language, user: UserContext) => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Setup Microphone State
      const track = stream.getAudioTracks()[0];
      if (track) {
          setActiveMicLabel(track.label || "Default Microphone");
          track.enabled = false; // Start muted by default
          setIsMuted(true); 
      }

      const modelId = 'gemini-2.5-flash-native-audio-preview-12-2025';

      let langInstruction = 'English';
      if (language === 'pt') langInstruction = 'Portuguese';
      if (language === 'es') langInstruction = 'Spanish';

      let personaInstruction = '';
      switch (user.persona) {
        case 'academic':
            personaInstruction = "You are a distinguished, detail-oriented Art Historian. Use formal language, discuss techniques deeply, and reference historical parallels.";
            break;
        case 'blogger':
            personaInstruction = "You are an energetic, trendy Art Influencer. Use exciting, accessible language, slang, and focus on what makes this piece 'viral' or cool. Keep it fast-paced.";
            break;
        case 'guide':
        default:
            personaInstruction = "You are a warm, friendly Museum Guide. Be accessible, encouraging, and helpful. Use simple metaphors.";
            break;
      }

      // Construct dynamic system instruction with deep analysis if available
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

      const systemInstruction = `
          ${personaInstruction}
          Your name is ArtLens. Address the user as "${user.name}".
          
          The user is looking at:
          Title: ${contextData.title}
          Artist: ${contextData.artist}
          Year: ${contextData.year}
          Description: ${contextData.description}
          ${deepContext}
          
          Goal: Have a spoken conversation in ${langInstruction}.
          IMPORTANT: Speak ONLY in ${langInstruction}.
      `;

      const sessionPromise = ai.live.connect({
        model: modelId,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: () => {
            console.log('Live Session Connected');
            setIsConnected(true);

            if (!inputContextRef.current) return;
            const ctx = inputContextRef.current;
            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              // Only process and send audio if the track is actually enabled (unmuted)
              // This prevents sending silence processing when muted
              if (audioStreamRef.current?.getAudioTracks()[0]?.enabled) {
                const inputData = e.inputBuffer.getChannelData(0);
                const blob = createPcmBlob(inputData);
                sessionPromise.then(session => session.sendRealtimeInput({ media: blob }));
              }
            };

            source.connect(processor);
            processor.connect(ctx.destination);
            sourceNodeRef.current = source;
            scriptProcessorRef.current = processor;
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription?.text) {
                currentModelTranscriptRef.current += msg.serverContent.outputTranscription.text;
                if (onTranscriptRef.current) onTranscriptRef.current(currentModelTranscriptRef.current, false, false);
            }

            if (msg.serverContent?.inputTranscription?.text) {
                currentUserTranscriptRef.current += msg.serverContent.inputTranscription.text;
                 if (onTranscriptRef.current) onTranscriptRef.current(currentUserTranscriptRef.current, true, false);
            }

            if (msg.serverContent?.turnComplete) {
                if (currentModelTranscriptRef.current && onTranscriptRef.current) {
                    onTranscriptRef.current(currentModelTranscriptRef.current, false, true);
                    currentModelTranscriptRef.current = '';
                }
                if (currentUserTranscriptRef.current && onTranscriptRef.current) {
                    onTranscriptRef.current(currentUserTranscriptRef.current, true, true);
                    currentUserTranscriptRef.current = '';
                }
            }

            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
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

            if (msg.serverContent?.interrupted) {
              scheduledSourcesRef.current.forEach(s => s.stop());
              scheduledSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              currentModelTranscriptRef.current = '';
            }
          },
          onclose: () => {
            console.log('Live Session Closed');
            setIsConnected(false);
            cleanup();
          },
          onerror: (err) => {
            console.error('Live Session Error', err);
            setError("Connection error");
            cleanup();
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Failed to connect", err);
      setError(err.message);
      cleanup();
    }
  }, [cleanup]);

  const sendTextInput = useCallback(async (text: string) => {
    // Resume audio context on user interaction (send text)
    await ensureAudioContext();
    
    if (sessionRef.current) {
        try {
            await sessionRef.current.sendClientContent({ turns: [{ parts: [{ text: text }] }] });
        } catch (e) { console.error("Failed to send text", e); }
    }
  }, [ensureAudioContext]);

  return { isConnected, isSpeaking, isMuted, activeMicLabel, connect, disconnect: cleanup, toggleMute, sendTextInput, error, setOnTranscript };
};
