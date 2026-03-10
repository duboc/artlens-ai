import { useState, useRef, useCallback, useEffect } from 'react';
import { IdentifyResponse, Language, ChatMessage } from '../types';
import { apiPost, apiGet } from '../services/apiClient';

export const useGeminiChat = (artData: IdentifyResponse, language: Language, explanationLength: 'brief' | 'detailed' = 'detailed', scanId?: string | null) => {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const hasLoadedRef = useRef(false);

  // Load chat history from Firestore on mount
  useEffect(() => {
    if (!scanId || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    apiGet<{ messages: Array<{ role: string; text: string; isAudioTranscription?: boolean; createdAt?: string }> }>(`/api/scans/${scanId}/chats`)
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m, i) => ({
            id: `loaded-${i}`,
            role: m.role as 'user' | 'model',
            text: m.text,
            timestamp: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
            isAudioTranscription: m.isAudioTranscription,
          })));
        }
      })
      .catch(err => console.error('Failed to load chat history:', err));
  }, [scanId]);

  // Persist a message to Firestore (non-blocking)
  const persistMessage = useCallback((role: string, text: string, isAudioTranscription: boolean = false) => {
    if (!scanId || !text.trim()) return;
    apiPost(`/api/scans/${scanId}/chats`, { role, text, isAudioTranscription }).catch(err => {
      console.error('Failed to persist chat message:', err);
    });
  }, [scanId]);

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

  // Use a ref to always have access to the latest messages without re-creating sendMessage
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now()
    };

    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    persistMessage('user', text);
    setIsLoading(true);

    try {
      // Build full conversation history for the API
      const contents = updatedMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const response = await apiPost('/api/generate', {
        contents,
        systemInstruction: {
          parts: [{ text: systemInstructionRef.current() }]
        },
      });

      const modelText = response.text || "...";
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: modelText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMsg]);
      persistMessage('model', modelText);
    } catch (e) {
      console.error("Chat error", e);
    } finally {
      setIsLoading(false);
    }
  }, [persistMessage]);

  // Helper to add externally generated messages (e.g. from Live API transcription)
  const addExternalMessage = useCallback((text: string, role: 'user' | 'model', isFinal: boolean) => {
    setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === role && lastMsg.isAudioTranscription && !isFinal) {
             return [...prev.slice(0, -1), { ...lastMsg, text: text }];
        }

        if (lastMsg && lastMsg.role === role && lastMsg.isAudioTranscription) {
             const updated = [...prev.slice(0, -1), { ...lastMsg, text: text }];
             if (isFinal) persistMessage(role, text, true);
             return updated;
        }

        const updated = [...prev, {
            id: Date.now().toString(),
            role,
            text,
            timestamp: Date.now(),
            isAudioTranscription: true
        }];
        if (isFinal) persistMessage(role, text, true);
        return updated;
    });
  }, [persistMessage]);

  return { messages, sendMessage, isLoading, addExternalMessage };
};
