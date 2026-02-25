import React, { useRef, useEffect, useState } from 'react';
import { IdentifyResponse, Language, UserContext } from '../types';
import { ChatWindow } from './ChatWindow';

interface AnalysisResultCardProps {
  data: IdentifyResponse;
  language: Language;
  userContext: UserContext;
  onClose: () => void;
  onDeepAnalyze?: () => void; // Made optional as it's now automated
  isDeepAnalyzing: boolean;
  forcedChatOpen?: boolean;
  initialChatQuery?: string | null;
  onChatClose?: () => void;
}

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({ 
  data, 
  language,
  userContext,
  onClose, 
  isDeepAnalyzing,
  forcedChatOpen = false,
  initialChatQuery = null,
  onChatClose
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Handle external force open (from annotations)
  useEffect(() => {
      if (forcedChatOpen) {
          setIsChatOpen(true);
          setIsMinimized(false);
      }
  }, [forcedChatOpen]);

  useEffect(() => {
    if (data.deepAnalysis && scrollRef.current && !isChatOpen && !isMinimized) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [data.deepAnalysis, isChatOpen, isMinimized]);

  const handleChatClose = () => {
      setIsChatOpen(false);
      if (onChatClose) onChatClose();
  };

  // Minimized "Pill" View
  if (isMinimized && !isChatOpen) {
      return (
          <div className="w-full max-w-lg mx-auto pointer-events-auto animate-slide-up mb-4 px-4">
              <div 
                  onClick={() => setIsMinimized(false)}
                  className="bg-[#1e1e1e]/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full p-2 pl-6 flex items-center justify-between cursor-pointer active:scale-95 transition-transform"
              >
                  <div className="flex flex-col overflow-hidden mr-4">
                      <span className="text-white font-semibold text-sm truncate">{data.title}</span>
                      <span className="text-zinc-400 text-xs truncate">{data.artist}</span>
                  </div>
                  <div className="flex gap-2">
                       <button 
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                       >
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                       </button>
                       <button 
                          onClick={(e) => { e.stopPropagation(); onClose(); }}
                          className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"
                       >
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                  </div>
              </div>
          </div>
      );
  }

  // Expanded / Chat View
  return (
    <div className={`w-full max-w-lg mx-auto transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto mb-0
        ${isChatOpen ? 'h-[85vh]' : 'h-auto'}
    `}>
      {/* Floating Card Surface */}
      <div className={`bg-[#1e1e1e]/95 backdrop-blur-xl border-t border-x border-white/10 shadow-2xl rounded-t-[2.5rem] overflow-hidden flex flex-col transition-all duration-500
          ${isChatOpen ? 'h-full rounded-b-none' : 'max-h-[60vh] rounded-b-[2.5rem] mb-6'}
      `}>
        
        {/* Drag Handle Area - Only visible when collapsed */}
        {!isChatOpen && (
          <div className="w-full flex justify-center pt-4 pb-2 cursor-pointer touch-none group" onClick={() => setIsMinimized(true)}>
              <div className="w-12 h-1.5 bg-zinc-600 rounded-full opacity-50 group-hover:bg-primary transition-colors" />
          </div>
        )}

        {/* Content Container */}
        <div className={`flex flex-col flex-1 min-h-0 ${isChatOpen ? '' : 'overflow-y-auto no-scrollbar'}`}>
          
          {isChatOpen ? (
            <ChatWindow 
                key={`${data.title}-${language}`} // Force remount when artwork or language changes to reset chat context
                artData={data} 
                language={language} 
                userContext={userContext}
                onClose={handleChatClose} 
                initialMessage={initialChatQuery}
            />
          ) : (
            <div ref={scrollRef} className="px-6 pb-8 pt-2 flex flex-col">
              
              {/* Title Header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                   <h2 className="text-2xl font-normal text-white leading-tight tracking-tight pr-2">
                    {data.title}
                  </h2>
                  <p className="text-secondary text-sm font-normal mt-1">{data.artist}, {data.year}</p>
                </div>
                {/* Close Button (X) */}
                <button 
                  onClick={onClose}
                  className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-white transition-colors shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                 <Badge label={data.country} />
                 <Badge label={data.style} />
              </div>

              {/* Action Buttons (Primary) */}
              <div className="flex gap-3 mb-6">
                  <button 
                    onClick={() => setIsChatOpen(true)}
                    className="flex-1 py-3.5 px-6 rounded-full bg-primary text-onPrimary font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                     <span>Chat with Guide</span>
                  </button>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-300 leading-relaxed mb-6 font-light">
                {data.description}
              </p>

              {/* Fun Fact Card */}
              {data.funFact && (
                <div className="bg-surface-variant p-4 rounded-2xl mb-6 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="text-lg">💡</span>
                     <span className="text-xs font-bold uppercase tracking-wider text-secondary">Did you know?</span>
                  </div>
                  <p className="text-xs text-zinc-300 italic leading-relaxed">"{data.funFact}"</p>
                </div>
              )}

              {/* Deep Analysis Content */}
              {data.deepAnalysis ? (
                <div className="space-y-6 animate-fade-in pb-2">
                  <Divider />
                  
                  {/* Curiosities / Unique Experiences (Highlighted First) */}
                  {data.deepAnalysis.curiosities && data.deepAnalysis.curiosities.length > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-4 opacity-10">
                               <svg className="w-16 h-16 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                           </div>
                           <h3 className="text-primary text-xs font-bold uppercase tracking-wider mb-3 relative z-10">Unique Insights</h3>
                           <ul className="space-y-3 relative z-10">
                               {data.deepAnalysis.curiosities.map((item, idx) => (
                                   <li key={idx} className="flex gap-3 text-sm text-zinc-200 font-light">
                                       <span className="text-primary mt-1">•</span>
                                       <span>{item}</span>
                                   </li>
                               ))}
                           </ul>
                      </div>
                  )}

                  <Section title="Historical Context" content={data.deepAnalysis.historicalContext} />
                  <Section title="Symbolism" content={data.deepAnalysis.symbolism} />
                </div>
              ) : isDeepAnalyzing ? (
                 <div className="flex flex-col gap-4 animate-pulse pb-4">
                     <Divider />
                     <div className="h-4 w-1/3 bg-white/10 rounded"></div>
                     <div className="h-20 w-full bg-white/5 rounded"></div>
                     <div className="h-4 w-1/4 bg-white/10 rounded"></div>
                     <div className="h-20 w-full bg-white/5 rounded"></div>
                     <p className="text-center text-xs text-zinc-500 italic mt-2">Uncovering hidden details...</p>
                 </div>
              ) : null}

              {/* Footer / Sources */}
              {data.sources.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-white/5">
                   <p className="text-[10px] text-zinc-500 mb-2">Sources</p>
                   <div className="flex flex-wrap gap-2">
                     {data.sources.slice(0, 3).map((source, i) => (
                       <a key={i} href={source.uri} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline truncate max-w-[150px]">
                         {source.title || 'Source'}
                       </a>
                     ))}
                   </div>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Badge = ({ label }: { label: string }) => (
  <span className="px-2.5 py-1 rounded-lg bg-surface-variant border border-white/5 text-xs text-zinc-300">
    {label}
  </span>
);

const Section = ({ title, content }: { title: string, content: string }) => (
  <div>
    <h3 className="text-primary text-xs font-semibold uppercase tracking-wider mb-1.5">{title}</h3>
    <p className="text-sm text-zinc-300 leading-relaxed font-light">{content}</p>
  </div>
);

const Divider = () => <div className="h-px bg-white/10 w-full my-2" />;
