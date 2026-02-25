import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { IdentifyResponse, Language, ChatMessage } from '../types';

export const useGeminiChat = (artData: IdentifyResponse, language: Language) => {
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);

  // Persistence Key based on Art Title to keep history specific to artwork
  // Using a sanitized version of the title as key
  const storageKey = `artlens_chat_${artData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${language}`;

  // Initialize State from LocalStorage (Lazy Initialization)
  // This prevents overwriting localStorage with [] on initial render
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load chat history", e);
      return [];
    }
  });

  // Save History on Change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  // Initialize Chat Client
  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let langInstruction = 'English';
    if (language === 'pt') langInstruction = 'Portuguese';
    if (language === 'es') langInstruction = 'Spanish';

    // Map existing messages to history format required by SDK
    // Note: We only use the initial state of 'messages' here to seed the chat. 
    // Subsequent updates to 'messages' do not need to re-create the chat client.
    const history = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    chatRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: history,
      config: {
        systemInstruction: `You are an expert art historian. User is looking at: "${artData.title}" by ${artData.artist}. Respond in ${langInstruction}.`,
      }
    });
  }, [artData.title, language]); // Intentionally omitting messages to avoid re-creation loops

  const sendMessage = async (text: string) => {
    if (!chatRef.current || !text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "...",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (e) {
      console.error("Chat error", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to add externally generated messages (e.g. from Live API transcription)
  const addExternalMessage = useCallback((text: string, role: 'user' | 'model', isFinal: boolean) => {
    setMessages(prev => {
        // If the last message is from the same role and is NOT final, we might want to update it (streaming effect)
        // For simplicity in this merged view, if we are streaming, we update the last message if it was marked as a 'pending transcription'
        
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === role && lastMsg.isAudioTranscription && !isFinal) {
             // Update existing pending message
             return [...prev.slice(0, -1), { ...lastMsg, text: text }];
        }
        
        // If it's a new final message, just add it. 
        // If it's a new streaming message start, add it.
        if (lastMsg && lastMsg.role === role && lastMsg.isAudioTranscription) {
             return [...prev.slice(0, -1), { ...lastMsg, text: text }];
        }

        return [...prev, {
            id: Date.now().toString(),
            role,
            text,
            timestamp: Date.now(),
            isAudioTranscription: true
        }];
    });
  }, []);

  return { messages, sendMessage, isLoading, addExternalMessage };
};
