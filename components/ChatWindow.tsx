import React, { useState, useRef, useEffect } from 'react';
import { IdentifyResponse, Language, UserContext } from '../types';
import { useGeminiChat } from '../hooks/useGeminiChat';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { t } from '../utils/i18n';

const getPersonaLabel = (persona: string, language: Language): string => {
  const map: Record<string, string> = {
    guide: t('result.guide', language),
    academic: t('result.curator', language),
    blogger: t('result.blogger', language),
  };
  return map[persona] || map.guide;
};

interface ChatWindowProps {
  artData: IdentifyResponse;
  language: Language;
  userContext: UserContext;
  onClose: () => void;
  initialMessage?: string | null;
  autoStartVoice?: boolean;
  onPersonaChange?: (persona: 'guide' | 'academic' | 'blogger') => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  artData,
  language,
  userContext,
  onClose,
  initialMessage,
  autoStartVoice = false,
  onPersonaChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [explanationLength, setExplanationLength] = useState<'brief' | 'detailed'>(() => {
    return (localStorage.getItem('artlens_explanationLength') as 'brief' | 'detailed') || 'detailed';
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasSentInitialRef = useRef(false);

  const hasDeepAnalysisRef = useRef(!!artData.deepAnalysis);

  const { messages, sendMessage, isLoading: isTextLoading, addExternalMessage } = useGeminiChat(artData, language, explanationLength);
  const { isConnected, isSpeaking, isMuted, activeMicLabel, connect, disconnect, toggleMute, sendTextInput, stopNarration, setOnTranscript, error: liveError } = useGeminiLive();

  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (initialMessage && !hasSentInitialRef.current) {
        hasSentInitialRef.current = true;
        sendMessage(initialMessage);
    }
  }, [initialMessage, sendMessage]);

  // Auto-start voice when chat opens via scan
  useEffect(() => {
    if (autoStartVoice && !isConnected && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      const timer = setTimeout(() => {
        connect(artData, language, userContext, explanationLength).catch(err => {
          console.error('Auto-start voice failed:', err);
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoStartVoice, isConnected, connect, artData, language, userContext, explanationLength]);

  useEffect(() => {
      setOnTranscript((text, isUser, isFinal) => {
          addExternalMessage(text, isUser ? 'user' : 'model', isFinal);
      });
  }, [setOnTranscript, addExternalMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
      if (!hasDeepAnalysisRef.current && artData.deepAnalysis && isConnected) {
          hasDeepAnalysisRef.current = true;
          const contextUpdate = `
            SYSTEM UPDATE: Deep analysis is now available.
            Historical Context: ${artData.deepAnalysis.historicalContext}
            Symbolism: ${artData.deepAnalysis.symbolism}
            Curiosities: ${artData.deepAnalysis.curiosities.join('; ')}
            Please incorporate these unique insights if relevant to the ongoing conversation.
          `;
          sendTextInput(contextUpdate);
      } else if (artData.deepAnalysis) {
          hasDeepAnalysisRef.current = true;
      }
  }, [artData.deepAnalysis, isConnected, sendTextInput]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (isConnected) {
        addExternalMessage(inputValue, 'user', true);
        await sendTextInput(inputValue);
    } else {
        await sendMessage(inputValue);
    }
    setInputValue('');
  };

  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  // Scroll input into view when soft keyboard opens
  const handleInputFocus = () => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  };

  const handleTopicClick = async (topic: string) => {
      addExternalMessage(topic, 'user', true);

      if (!isConnected) {
          try {
             await connect(artData, language, userContext, explanationLength);
             await new Promise(r => setTimeout(r, 500));
             await sendTextInput(topic);
          } catch(e) {
              console.error("Failed to start voice on topic", e);
          }
      } else {
          await sendTextInput(topic);
      }
  };

  const handleRetryConnection = () => {
      connect(artData, language, userContext, explanationLength);
  };

  const handleVoiceStart = () => {
      connect(artData, language, userContext, explanationLength);
  };

  const toggleLength = () => {
    const next = explanationLength === 'brief' ? 'detailed' : 'brief';
    setExplanationLength(next);
    localStorage.setItem('artlens_explanationLength', next);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface)] border-b border-[var(--primary-dim)] shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-primary/10 text-secondary transition-colors duration-300 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className="min-w-0">
             <div className="flex items-center gap-2">
                 <h3 className="font-serif text-base text-[var(--text)] truncate">{userContext.name}'s {getPersonaLabel(userContext.persona, language)}</h3>
                 {isConnected && !isMuted && (
                     <span className="relative flex h-2 w-2 flex-shrink-0">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                     </span>
                 )}
             </div>
             <p className="text-xs text-secondary/60 truncate flex items-center gap-1 font-mono">
                {onPersonaChange ? (
                  <button
                    onClick={() => setShowPersonaPicker(!showPersonaPicker)}
                    className="text-secondary/60 hover:text-primary transition-colors flex items-center gap-1"
                  >
                    {getPersonaLabel(userContext.persona, language)}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                ) : (
                  getPersonaLabel(userContext.persona, language)
                )}
                {isConnected && activeMicLabel && (
                  <>
                     <span>·</span>
                     <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider border border-[var(--primary-dim)] px-1.5 py-0.5 rounded-full">
                       <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                       {activeMicLabel}
                     </span>
                  </>
                )}
             </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSpeaking && (
            <>
               <div className="flex gap-0.5 items-center h-4 flex-shrink-0">
                   <span className="w-0.5 h-2.5 bg-primary animate-pulse rounded-full" />
                   <span className="w-0.5 h-4 bg-primary animate-pulse rounded-full delay-75" />
                   <span className="w-0.5 h-2 bg-primary animate-pulse rounded-full delay-150" />
               </div>
               <button
                 onClick={stopNarration}
                 className="px-3 py-1.5 text-xs font-mono text-secondary border border-[var(--primary-dim)] rounded-full hover:text-primary hover:border-primary/30 transition-colors duration-300"
               >
                 Stop
               </button>
            </>
          )}
        </div>
      </div>

      {/* Persona Picker Dropdown */}
      {showPersonaPicker && onPersonaChange && (
        <div className="flex gap-2 px-5 py-2.5 bg-[var(--surface)] border-b border-[var(--primary-dim)] shrink-0">
          {(['guide', 'academic', 'blogger'] as const).map(p => (
            <button
              key={p}
              onClick={() => {
                onPersonaChange(p);
                setShowPersonaPicker(false);
                if (isConnected) {
                  disconnect();
                  setTimeout(() => connect(artData, language, { ...userContext, persona: p }, explanationLength), 300);
                }
              }}
              className={`flex-1 py-2 rounded-full text-xs font-medium transition-all duration-300
                ${userContext.persona === p
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-[var(--surface-variant)] text-secondary border border-[var(--primary-dim)] hover:border-primary/20'
                }`}
            >
              {getPersonaLabel(p, language)}
            </button>
          ))}
        </div>
      )}

      {/* Voice Active Bar */}
      {isConnected && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-primary/10 border-b border-primary/15 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono text-primary uppercase tracking-wider">{t('chat.voiceActive', language)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLength}
              className="px-3 py-1 text-xs font-mono text-secondary/70 border border-[var(--primary-dim)] rounded-full hover:text-primary hover:border-primary/20 transition-colors duration-300"
            >
              {explanationLength === 'brief' ? t('chat.brief', language) : t('chat.detailed', language)}
            </button>
            <button
              onClick={disconnect}
              className="px-3 py-1 text-xs font-mono text-error/80 border border-error/20 rounded-full hover:bg-error/10 transition-colors duration-300"
            >
              {t('chat.disconnect', language)}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {liveError && (
             <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                 <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center mb-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 </div>
                 <p className="text-error text-sm font-medium mb-2">{t('chat.connectionFailed', language)}</p>
                 <button
                   onClick={handleRetryConnection}
                   className="px-4 py-1.5 border border-[var(--primary-dim)] hover:border-primary/30 text-secondary hover:text-primary text-xs rounded-full transition-colors duration-300"
                 >
                   {t('chat.retry', language)}
                 </button>
             </div>
        )}

        {messages.length === 0 && !liveError && (
          <div className="h-full flex flex-col items-center justify-center text-secondary space-y-6 px-8 text-center">
            <div className="w-16 h-16 rounded-full border border-[var(--primary-dim)] flex items-center justify-center">
              <svg className="w-7 h-7 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <div>
              <p className="text-sm text-[var(--text)] font-serif mb-2">{t('chat.selectTopic', language)}</p>
              <p className="text-xs text-secondary/60">{t('chat.topicsBelow', language)}</p>
            </div>
            {/* Voice start button */}
            {!isConnected && (
              <button
                onClick={handleVoiceStart}
                className="px-5 py-2.5 rounded-full border border-primary/20 text-primary text-sm hover:bg-primary/10 transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                <span>{t('chat.startVoice', language)}</span>
              </button>
            )}
          </div>
        )}

        {messages.map((msg, idx) => {
           const isUser = msg.role === 'user';
           return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                  ${isUser
                    ? 'bg-primary/15 text-primary border border-primary/10 rounded-tr-sm'
                    : 'bg-[var(--surface)] text-[var(--text)]/90 border border-[var(--primary-dim)] rounded-tl-sm'
                  }`}
              >
                {msg.text}
              </div>
            </div>
           );
        })}

        {/* Loading */}
        {isTextLoading && !isConnected && (
            <div className="flex justify-start">
               <div className="bg-[var(--surface)] border border-[var(--primary-dim)] rounded-2xl px-4 py-3 rounded-tl-sm flex gap-1.5 items-center h-8">
                 <span className="w-1 h-1 bg-primary/40 rounded-full animate-bounce" />
                 <span className="w-1 h-1 bg-primary/40 rounded-full animate-bounce delay-100" />
                 <span className="w-1 h-1 bg-primary/40 rounded-full animate-bounce delay-200" />
               </div>
            </div>
        )}
      </div>

      {/* Topic Chips Bar */}
      <div className="px-4 py-2.5 bg-[var(--surface)] border-t border-[var(--primary-dim)] overflow-x-auto no-scrollbar flex gap-2 shrink-0">
         <TopicChip label={t('chat.aboutArtist', language)} onClick={() => handleTopicClick(`Who is ${artData.artist}? Tell me about their life and work.`)} highlight />
         {artData.annotations?.map((ann) => (
             <TopicChip
                key={ann.id}
                label={ann.label}
                onClick={() => handleTopicClick(`What can you tell me about "${ann.label}" in this artwork?`)}
             />
         ))}

         {artData.deepAnalysis && (
            <>
                <TopicChip label={t('chat.historicalContext', language)} onClick={() => handleTopicClick(`What is the historical context of "${artData.title}"?`)} />
                <TopicChip label={t('chat.symbolism', language)} onClick={() => handleTopicClick(`What symbolism is present in "${artData.title}"?`)} />
                {artData.deepAnalysis.curiosities?.length > 0 && (
                     <TopicChip label={t('chat.curiosities', language)} onClick={() => handleTopicClick(`What are some curious facts about "${artData.title}"?`)} />
                )}
            </>
         )}

         {!artData.deepAnalysis && (
            <>
                <TopicChip label={t('chat.historicalContext', language)} onClick={() => handleTopicClick(`What is the historical context of "${artData.title}"?`)} />
                <TopicChip label={t('chat.styleTechnique', language)} onClick={() => handleTopicClick(`What art style and techniques are used in "${artData.title}"?`)} />
            </>
         )}
      </div>

      {/* Input */}
      <div className="p-4 pb-safe bg-[var(--surface)] shrink-0">
        <div className="flex gap-2 items-center">

          {/* Mute Toggle */}
          {isConnected && (
             <button
                onClick={toggleMute}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0
                  ${isMuted
                    ? 'bg-[var(--surface-variant)] text-secondary hover:text-primary'
                    : 'bg-error/10 text-error ring-1 ring-error/30 hover:bg-error/20'
                  }`}
             >
                {isMuted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                )}
             </button>
          )}

          <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                placeholder={isConnected ? (isMuted ? t('chat.message', language) : t('chat.listening', language)) : t('chat.message', language)}
                className="w-full bg-[var(--surface-variant)] border border-[var(--primary-dim)] rounded-full px-4 py-3 text-base text-[var(--text)] placeholder-secondary/40 focus:outline-none focus:border-primary/40 transition-colors duration-300"
              />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-onPrimary disabled:opacity-30 disabled:bg-[var(--surface-variant)] disabled:text-secondary/40 transition-all duration-300 shadow-lg shadow-primary/10 flex-shrink-0"
          >
            <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

interface TopicChipProps {
  label: string;
  onClick: () => void;
  highlight?: boolean;
}

const TopicChip: React.FC<TopicChipProps> = ({ label, onClick, highlight = false }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 active:scale-95
           ${highlight
               ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
               : 'bg-[var(--surface-variant)] text-secondary border border-[var(--primary-dim)] hover:border-primary/20 hover:text-primary'
           }
        `}
    >
        {label}
    </button>
);
