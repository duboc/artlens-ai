import { useState, useRef, useCallback } from 'react';
import { IdentifyResponse, Language, ChatMessage } from '../types';
import { apiPost } from '../services/apiClient';

export const useGeminiChat = (artData: IdentifyResponse, language: Language, explanationLength: 'brief' | 'detailed' = 'detailed') => {
  const [isLoading, setIsLoading] = useState(false);

  // Persistence Key based on Art Title to keep history specific to artwork
  const storageKey = `artlens_chat_${artData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${language}`;

  // Initialize State from LocalStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load chat history", e);
      return [];
    }
  });

  // Build system instruction once
  const systemInstructionRef = useRef(() => {
    let langInstruction = 'English';
    if (language === 'pt') langInstruction = 'Portuguese';
    if (language === 'es') langInstruction = 'Spanish';
    const lengthHint = explanationLength === 'brief'
      ? ' Keep responses concise — 2-3 sentences maximum.'
      : '';
    return `You are an expert art historian. User is looking at: "${artData.title}" by ${artData.artist}. Respond in ${langInstruction}.${lengthHint}`;
  });

  // Save History on Change
  const saveMessages = useCallback((msgs: ChatMessage[]) => {
    localStorage.setItem(storageKey, JSON.stringify(msgs));
  }, [storageKey]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now()
    };

    setMessages(prev => {
      const updated = [...prev, userMsg];
      saveMessages(updated);
      return updated;
    });
    setIsLoading(true);

    try {
      // Build full conversation history for the API
      // Use current messages + the new user message
      setMessages(currentMessages => {
        // Build contents from all messages (including userMsg which was just added)
        const contents = currentMessages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        }));

        // Fire the API call (async, result handled via .then)
        apiPost('/api/generate', {
          contents,
          systemInstruction: {
            parts: [{ text: systemInstructionRef.current() }]
          },
        }).then(response => {
          const modelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: response.text || "...",
            timestamp: Date.now()
          };
          setMessages(prev => {
            const updated = [...prev, modelMsg];
            saveMessages(updated);
            return updated;
          });
        }).catch(e => {
          console.error("Chat error", e);
        }).finally(() => {
          setIsLoading(false);
        });

        return currentMessages; // Don't change state here
      });
    } catch (e) {
      console.error("Chat error", e);
      setIsLoading(false);
    }
  }, [saveMessages]);

  // Helper to add externally generated messages (e.g. from Live API transcription)
  const addExternalMessage = useCallback((text: string, role: 'user' | 'model', isFinal: boolean) => {
    setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === role && lastMsg.isAudioTranscription && !isFinal) {
             return [...prev.slice(0, -1), { ...lastMsg, text: text }];
        }

        if (lastMsg && lastMsg.role === role && lastMsg.isAudioTranscription) {
             const updated = [...prev.slice(0, -1), { ...lastMsg, text: text }];
             saveMessages(updated);
             return updated;
        }

        const updated = [...prev, {
            id: Date.now().toString(),
            role,
            text,
            timestamp: Date.now(),
            isAudioTranscription: true
        }];
        if (isFinal) saveMessages(updated);
        return updated;
    });
  }, [saveMessages]);

  return { messages, sendMessage, isLoading, addExternalMessage };
};
