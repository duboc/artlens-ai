import React, { useEffect, useRef, useState } from 'react';
import { AiTrace, GroundingSource, Language } from '../../types';
import { t, tf } from '../../utils/i18n';
import { ChevronIcon, SearchIcon } from './icons';

interface AiTracePanelProps {
  trace?: AiTrace;
  sources: GroundingSource[];
  language: Language;
  defaultOpen?: boolean;
}

const domainOf = (url?: string) => {
  try {
    return new URL(url || '').hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
};

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}\u202Fs`;

/** "How the AI thought": model, time, confidence, Google searches and sources behind one identification. */
export const AiTracePanel: React.FC<AiTracePanelProps> = ({ trace, sources, language, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const sectionRef = useRef<HTMLElement>(null);
  const panelId = 'ai-trace-panel';

  useEffect(() => {
    if (open && !defaultOpen) sectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [open, defaultOpen]);

  return (
    <section ref={sectionRef} className="mt-6 border-t border-white/[0.08] scroll-mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full min-h-[52px] flex items-center justify-between gap-3 text-left"
      >
        <span className="text-base font-medium text-[var(--text)]">{t('ai.title', language)}</span>
        <span className="flex items-center gap-2 text-secondary">
          {trace?.latencyMs != null && <span className="font-mono tabular text-sm">{formatSeconds(trace.latencyMs)}</span>}
          <ChevronIcon className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div id={panelId} className="pb-4 animate-fade-in">
          <p className="text-sm text-[var(--text)]/80 leading-relaxed max-w-[60ch]">{t('ai.summary', language)}</p>

          {trace ? (
            <>
              <dl className="mt-4 text-sm border-t border-white/[0.06]">
                <Fact label={t('ai.model', language)} stacked>
                  <span className="font-mono">{trace.model}</span>
                  {trace.fallbackUsed && <span className="block text-xs text-secondary">{t('ai.fallback', language)}</span>}
                </Fact>
                {trace.latencyMs != null && (
                  <Fact label={t('ai.time', language)}><span className="font-mono tabular">{formatSeconds(trace.latencyMs)}</span></Fact>
                )}
                {trace.thinkingLevel && (
                  <Fact label={t('ai.thinking', language)}><span className="font-mono">{trace.thinkingLevel.toLowerCase()}</span></Fact>
                )}
                {trace.confidence && (
                  <Fact label={t('ai.confidence', language)}>
                    <ConfidenceMeter level={trace.confidence} />
                    {t(`ai.conf.${trace.confidence}`, language)}
                  </Fact>
                )}
                {trace.museumContext && (
                  <Fact label={t('ai.context', language)}>{tf('ai.contextValue', language, { museum: trace.museumContext })}</Fact>
                )}
              </dl>

              {trace.evidence && (
                <p className="mt-4 text-sm text-[var(--text)]/85 italic leading-relaxed max-w-[60ch]">“{trace.evidence}”</p>
              )}

              <h4 className="mt-6 text-sm text-secondary">{t('ai.searches', language)}</h4>
              {trace.searchQueries.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {trace.searchQueries.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text)]/90">
                      <SearchIcon className="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--text)]/70">{t('ai.noSearches', language)}</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-secondary">{t('ai.unavailable', language)}</p>
          )}

          {sources.length > 0 && (
            <>
              <h4 className="mt-6 text-sm text-secondary">{t('result.sources', language)}</h4>
              <ul className="mt-1">
                {sources.slice(0, 6).map((source, i) => (
                  <li key={i}>
                    <a
                      href={source.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-baseline justify-between gap-3 min-h-[44px] py-2 border-b border-white/[0.06] text-sm text-primary underline-offset-4 hover:underline"
                    >
                      <span className="truncate">{source.title || domainOf(source.uri)}</span>
                      <span className="shrink-0 text-xs text-secondary">{domainOf(source.uri)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode; stacked?: boolean }> = ({ label, children, stacked }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/[0.06]">
    <dt className="text-secondary shrink-0 whitespace-nowrap">{label}</dt>
    <dd className={`text-right text-[var(--text)] flex gap-2 justify-end min-w-0 ${stacked ? 'flex-col items-end break-all' : 'items-center'}`}>{children}</dd>
  </div>
);

/** Three short bars, filled by confidence level (high = 3). */
const ConfidenceMeter: React.FC<{ level: 'high' | 'medium' | 'low' }> = ({ level }) => {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`w-1 rounded-sm ${i < filled ? 'bg-primary' : 'bg-white/20'}`} style={{ height: 6 + i * 3 }} />
      ))}
    </span>
  );
};
