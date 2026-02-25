import React, { useState, useRef, useEffect } from 'react';
import { IdentifyResponse, Language, UserContext } from '../types';
import { useGeminiChat } from '../hooks/useGeminiChat';
import { useGeminiLive } from '../hooks/useGeminiLive';

interface ChatWindowProps {
  artData: IdentifyResponse;
  language: Language;
  userContext: UserContext;
  onClose: () => void;
  initialMessage?: string | null;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  artData, 
  language, 
  userContext,
  onClose,
  initialMessage
}) => {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasSentInitialRef = useRef(false);
  
  // Track deep analysis presence to detect changes
  const hasDeepAnalysisRef = useRef(!!artData.deepAnalysis);

  const { messages, sendMessage, isLoading: isTextLoading, addExternalMessage } = useGeminiChat(artData, language);
  const { isConnected, isSpeaking, isMuted, activeMicLabel, connect, disconnect, toggleMute, sendTextInput, setOnTranscript, error: liveError } = useGeminiLive();

  // Handle Initial Message (if any)
  useEffect(() => {
    if (initialMessage && !hasSentInitialRef.current) {
        hasSentInitialRef.current = true;
        sendMessage(initialMessage);
    }
  }, [initialMessage, sendMessage]);

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

  // Effect: Watch for Deep Analysis arriving late. If we are connected, feed it to the model.
  useEffect(() => {
      if (!hasDeepAnalysisRef.current && artData.deepAnalysis && isConnected) {
          console.log("Deep analysis arrived during active session. Updating model context.");
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleTopicClick = async (topic: string) => {
      const query = `Tell me about the ${topic}`;
      
      // Optimistically add message
      addExternalMessage(query, 'user', true);

      // If not connected, connect first
      if (!isConnected) {
          try {
             await connect(artData, language, userContext);
             // Small delay to ensure session is fully ready for input
             await new Promise(r => setTimeout(r, 500)); 
             await sendTextInput(query);
          } catch(e) {
              console.error("Failed to start voice on topic", e);
          }
      } else {
          await sendTextInput(query);
      }
  };

  const handleRetryConnection = () => {
      connect(artData, language, userContext);
  };

  return (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#1e1e1e] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4 overflow-hidden">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/5 text-zinc-400 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className="min-w-0">
             <div className="flex items-center gap-2">
                 <h3 className="text-base font-semibold text-white truncate">{userContext.name}'s Guide</h3>
                 {isConnected && !isMuted && (
                     <span className="relative flex h-2 w-2 flex-shrink-0">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                     </span>
                 )}
             </div>
             <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                {userContext.persona} 
                {isConnected && activeMicLabel && (
                  <>
                     <span>•</span>
                     <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide border border-zinc-700 px-1.5 py-0.5 rounded-full">
                       <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                       {activeMicLabel}
                     </span>
                  </>
                )}
             </p>
          </div>
        </div>
        {isSpeaking && (
             <div className="flex gap-1 items-center h-4 ml-2 flex-shrink-0">
                 <span className="w-1 h-3 bg-primary animate-pulse rounded-full"></span>
                 <span className="w-1 h-5 bg-primary animate-pulse rounded-full delay-75"></span>
                 <span className="w-1 h-2 bg-primary animate-pulse rounded-full delay-150"></span>
             </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {liveError && (
             <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                 <div className="w-10 h-10 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 </div>
                 <p className="text-red-400 text-sm font-medium mb-1">Connection Failed</p>
                 <button 
                   onClick={handleRetryConnection}
                   className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-full transition-colors"
                 >
                   Retry
                 </button>
             </div>
        )}

        {messages.length === 0 && !liveError && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 px-8 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors duration-300 ${isMuted ? 'bg-zinc-800 text-zinc-600' : 'bg-primary/20 text-primary'}`}>
                {isMuted ? '🔇' : '🎙️'}
            </div>
            <div>
                <p className="text-sm text-white font-medium mb-1">Select a topic to start voice chat</p>
                <p className="text-xs text-zinc-500">
                    Choose from the discovered topics below
                </p>
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => {
           const isUser = msg.role === 'user';
           return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
                  ${isUser 
                    ? 'bg-primary text-onPrimary rounded-tr-sm' 
                    : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                  }`}
              >
                {msg.text}
              </div>
            </div>
           );
        })}
        
        {/* Loading Bubble */}
        {isTextLoading && !isConnected && (
            <div className="flex justify-start">
               <div className="bg-zinc-800 rounded-2xl px-4 py-3 rounded-tl-sm flex gap-1.5 items-center h-8">
                 <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce"></span>
                 <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce delay-100"></span>
                 <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce delay-200"></span>
               </div>
            </div>
        )}
      </div>

      {/* Discovery Topics Bar */}
      <div className="px-4 py-2 bg-[#1e1e1e] border-t border-white/5 overflow-x-auto no-scrollbar flex gap-2 shrink-0">
         <TopicChip label="About the Artist" onClick={() => handleTopicClick(`Artist ${artData.artist}`)} highlight />
         {artData.annotations?.map((ann) => (
             <TopicChip 
                key={ann.id} 
                label={ann.label} 
                onClick={() => handleTopicClick(ann.label)} 
             />
         ))}
         
         {/* Dynamic Chips based on Deep Analysis */}
         {artData.deepAnalysis && (
            <>
                <TopicChip label="Historical Context" onClick={() => handleTopicClick(`Historical context of ${artData.title}`)} />
                <TopicChip label="Symbolism" onClick={() => handleTopicClick(`Symbolism in ${artData.title}`)} />
                {artData.deepAnalysis.curiosities?.length > 0 && (
                     <TopicChip label="Curiosities" onClick={() => handleTopicClick(`Tell me curious facts about ${artData.title}`)} />
                )}
            </>
         )}

         {!artData.deepAnalysis && (
            <>
                <TopicChip label="Historical Context" onClick={() => handleTopicClick(`Historical context of ${artData.title}`)} />
                <TopicChip label="Style & Technique" onClick={() => handleTopicClick(`Art style of ${artData.title}`)} />
            </>
         )}
      </div>

      {/* Input */}
      <div className="p-4 bg-[#1e1e1e] shrink-0">
        <div className="flex gap-2 items-center">
          
          {/* Mute Toggle */}
          {isConnected && (
             <button 
                onClick={toggleMute}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isMuted ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30 ring-1 ring-red-500/50'}`}
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
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? (isMuted ? "Message..." : "Listening...") : "Message..."}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-full px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
              />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-onPrimary disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors shadow-lg flex-shrink-0"
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
        className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95
           ${highlight 
               ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30' 
               : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
           }
        `}
    >
        {label}
    </button>
);
