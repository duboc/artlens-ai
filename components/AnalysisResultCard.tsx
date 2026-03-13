import React, { useRef, useEffect, useState } from 'react';
import { IdentifyResponse, Language, UserContext } from '../types';
import { ChatWindow } from './ChatWindow';
import { preWarmAudio } from '../hooks/useGeminiLive';
import { t } from '../utils/i18n';
import { createArtworkShareCard, shareOrDownload } from '../utils/shareCard';

interface AnalysisResultCardProps {
  data: IdentifyResponse;
  language: Language;
  userContext: UserContext;
  scanId?: string | null;
  artworkImageUrl?: string | null;
  onClose: () => void;
  onDeepAnalyze?: () => void;
  isDeepAnalyzing: boolean;
  forcedChatOpen?: boolean;
  initialChatQuery?: string | null;
  onChatClose?: () => void;
  onScanAnother?: () => void;
  onPersonaChange?: (persona: 'guide' | 'academic' | 'blogger') => void;
  onGenerateMe?: () => void;
  hasSelfie?: boolean;
  narrationIsPlaying?: boolean;
  narrationIsGenerating?: boolean;
  narrationScript?: string | null;
  onStopNarration?: () => void;
}

const getPersonaLabel = (persona: string, language: Language): string => {
  const map: Record<string, string> = {
    guide: t('result.guide', language),
    academic: t('result.curator', language),
    blogger: t('result.blogger', language),
  };
  return map[persona] || map.guide;
};

const getDomainFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'source';
  }
};

const handleShare = async (data: IdentifyResponse, imageUrl: string | null) => {
  if (!imageUrl) return;
  try {
    const blob = await createArtworkShareCard(imageUrl, data);
    const filename = `artlens-${data.title.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    await shareOrDownload(
      blob,
      filename,
      data.title,
      `${data.title} by ${data.artist} (${data.year}) — AI Leadership Academy`,
    );
  } catch { /* user cancelled or error */ }
};

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({
  data,
  language,
  userContext,
  scanId = null,
  artworkImageUrl = null,
  onClose,
  isDeepAnalyzing,
  forcedChatOpen = false,
  initialChatQuery = null,
  onChatClose,
  onScanAnother,
  onPersonaChange,
  onGenerateMe,
  hasSelfie = false,
  narrationIsPlaying = false,
  narrationIsGenerating = false,
  narrationScript = null,
  onStopNarration,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showNarrationCta, setShowNarrationCta] = useState(false);
  const prevNarrationPlaying = useRef(false);

  // Detect narration finish → show CTA
  useEffect(() => {
    if (prevNarrationPlaying.current && !narrationIsPlaying && !narrationIsGenerating) {
      setShowNarrationCta(true);
      const timer = setTimeout(() => setShowNarrationCta(false), 8000);
      return () => clearTimeout(timer);
    }
    prevNarrationPlaying.current = narrationIsPlaying || false;
  }, [narrationIsPlaying, narrationIsGenerating]);

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

  // Minimized "Pill" View — warm glass with gold accent
  if (isMinimized && !isChatOpen) {
      return (
          <div className="w-full max-w-lg mx-auto pointer-events-auto animate-slide-up mb-4 px-4">
              <div
                  onClick={() => setIsMinimized(false)}
                  className="bg-black/60 backdrop-blur-2xl border border-white/[0.08] shadow-2xl rounded-full p-2 pl-6 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all duration-300"
              >
                  <div className="flex flex-col overflow-hidden mr-4">
                      <span className="font-serif text-[var(--text)] text-sm truncate">{data.title}</span>
                      <span className="text-secondary text-xs truncate">{data.artist}</span>
                  </div>
                  <div className="flex gap-2">
                       <button
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                        className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"
                       >
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                       </button>
                       <button
                          onClick={(e) => { e.stopPropagation(); onClose(); }}
                          className="w-10 h-10 rounded-full bg-[var(--surface)] flex items-center justify-center text-secondary"
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
      <div className={`bg-black/70 backdrop-blur-2xl border-t border-x border-white/[0.08] shadow-2xl rounded-t-[2.5rem] overflow-hidden flex flex-col transition-all duration-500
          ${isChatOpen ? 'h-full rounded-b-none' : 'max-h-[60vh] rounded-b-[2.5rem] mb-6'}
      `}>

        {/* Drag Handle */}
        {!isChatOpen && (
          <div className="w-full flex justify-center pt-4 pb-2 cursor-pointer touch-none group" onClick={() => setIsMinimized(true)}>
              <div className="w-12 h-1 bg-secondary/30 rounded-full group-hover:bg-primary/50 transition-colors duration-300" />
          </div>
        )}

        {/* Content */}
        <div className={`flex flex-col flex-1 min-h-0 ${isChatOpen ? '' : 'overflow-y-auto no-scrollbar'}`}>

          {isChatOpen ? (
            <ChatWindow
                key={`${data.title}-${language}`}
                artData={data}
                language={language}
                userContext={userContext}
                scanId={scanId}
                onClose={handleChatClose}
                initialMessage={initialChatQuery}
                autoStartVoice
                onPersonaChange={onPersonaChange}
                narrationScript={narrationScript}
            />
          ) : (
            <div ref={scrollRef} className="px-6 pb-8 pt-2 flex flex-col">

              {/* Title Header */}
              <div className="flex justify-between items-start mb-5">
                <div className="flex-1 pr-4">
                  <h2 className="font-serif text-2xl text-[var(--text)] leading-tight tracking-tight">
                    {data.title}
                  </h2>
                  <p className="text-secondary text-sm mt-1.5">{data.artist}, {data.year}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {/* Share */}
                  <button
                    onClick={() => handleShare(data, artworkImageUrl)}
                    className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-300"
                    aria-label="Share"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                  {/* Close */}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-[var(--surface-variant)] hover:bg-secondary/20 text-secondary transition-colors duration-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tags — gold accent borders */}
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge label={data.country} />
                <Badge label={data.style} />
              </div>

              {/* Narration Indicator */}
              {(narrationIsPlaying || narrationIsGenerating) && (
                <div className="flex items-center gap-3 mb-4 px-1">
                  {narrationIsGenerating ? (
                    <div className="flex items-center gap-2 text-secondary/60">
                      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-xs font-mono">Preparing narration...</span>
                    </div>
                  ) : (
                    <button
                      onClick={onStopNarration}
                      className="flex items-center gap-2 text-primary/80 hover:text-primary transition-colors"
                    >
                      <div className="flex items-center gap-0.5">
                        <div className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="w-0.5 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="w-0.5 h-2.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        <div className="w-0.5 h-3.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                      </div>
                      <span className="text-xs font-mono">Narrating — tap to stop</span>
                    </button>
                  )}
                </div>
              )}

              {/* Post-Narration CTA */}
              {showNarrationCta && (
                <div className="mb-4 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20 animate-fade-in flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                  </svg>
                  <p className="text-xs text-[var(--text)]/80 leading-relaxed">{t('result.narrationCta', language)}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => { if (onStopNarration) onStopNarration(); preWarmAudio(); setIsChatOpen(true); }}
                  className="flex-1 py-3.5 px-6 rounded-full bg-primary text-onPrimary font-semibold text-sm transition-all duration-300 hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  <span>{t('result.chatWith', language)} {getPersonaLabel(userContext.persona, language)}</span>
                </button>
              </div>

              {/* Generate Me Button */}
              {onGenerateMe && hasSelfie && (
                <button
                  onClick={onGenerateMe}
                  className="w-full py-3 mb-6 rounded-full border border-primary/20 text-primary text-sm hover:bg-primary/10 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <span>{t('generate.button', language)}</span>
                </button>
              )}

              {/* Scan Another */}
              {onScanAnother && (
                <button
                  onClick={onScanAnother}
                  className="w-full py-3 mb-6 rounded-full border border-white/[0.1] text-white/60 text-sm hover:text-primary hover:border-primary/30 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{t('result.scanAnother', language)}</span>
                </button>
              )}

              {/* Description */}
              <p className="text-sm text-[var(--text)]/80 leading-relaxed mb-6">
                {data.description}
              </p>

              {/* Fun Fact Card — gold tinted */}
              {data.funFact && (
                <div className="bg-primary/[0.08] border border-primary/15 p-5 rounded-2xl mb-6">
                  <p className="text-xs font-mono uppercase tracking-[0.15em] text-primary/70 mb-2">
                    {t('result.didYouKnow', language)}
                  </p>
                  <p className="text-sm text-[var(--text)]/70 italic leading-relaxed">"{data.funFact}"</p>
                </div>
              )}

              {/* Deep Analysis */}
              {data.deepAnalysis ? (
                <div className="space-y-6 animate-fade-in pb-2">
                  <Divider />

                  {/* Curiosities — highlighted gold card */}
                  {data.deepAnalysis.curiosities && data.deepAnalysis.curiosities.length > 0 && (
                    <div className="bg-primary/[0.08] border border-primary/15 rounded-2xl p-5 relative overflow-hidden">
                      <h3 className="font-mono text-primary/80 text-xs uppercase tracking-[0.15em] mb-3">{t('result.uniqueInsights', language)}</h3>
                      <ul className="space-y-3">
                        {data.deepAnalysis.curiosities.map((item, idx) => (
                          <li key={idx} className="flex gap-3 text-sm text-[var(--text)]/80">
                            <span className="text-primary/60 mt-0.5 shrink-0 min-h-auto">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            </span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Section title={t('result.historicalContext', language)} content={data.deepAnalysis.historicalContext} />

                  {/* Technical Analysis — new section */}
                  {data.deepAnalysis.technicalAnalysis && (
                    <Section title={t('result.technique', language)} content={data.deepAnalysis.technicalAnalysis} />
                  )}

                  <Section title={t('result.symbolism', language)} content={data.deepAnalysis.symbolism} />
                </div>
              ) : isDeepAnalyzing ? (
                <div className="flex flex-col gap-4 animate-pulse pb-4">
                  <Divider />
                  <div className="h-3 w-1/3 bg-primary/10 rounded" />
                  <div className="h-20 w-full bg-primary/5 rounded-xl" />
                  <div className="h-3 w-1/4 bg-primary/10 rounded" />
                  <div className="h-20 w-full bg-primary/5 rounded-xl" />
                  <p className="text-center text-xs text-secondary/50 italic mt-2">{t('result.uncovering', language)}</p>
                </div>
              ) : null}

              {/* Sources — domain chips */}
              {data.sources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.08]">
                  <p className="text-[10px] font-mono text-secondary/40 mb-2 uppercase tracking-wider">{t('result.sources', language)}</p>
                  <div className="flex flex-wrap gap-2">
                    {data.sources.slice(0, 3).map((source, i) => (
                      <a
                        key={i}
                        href={source.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-auto text-[10px] font-mono text-primary/60 bg-primary/5 border border-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/10 transition-colors duration-300"
                      >
                        {source.title || getDomainFromUrl(source.uri || '')}
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
  <span className="min-h-auto px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.1] text-xs font-mono text-white/70">
    {label}
  </span>
);

const Section = ({ title, content }: { title: string; content: string }) => (
  <div>
    <h3 className="font-mono text-primary/70 text-xs uppercase tracking-[0.15em] mb-2">{title}</h3>
    <p className="text-sm text-[var(--text)]/80 leading-relaxed">{content}</p>
  </div>
);

const Divider = () => <div className="h-px bg-white/[0.08] w-full my-2" />;
