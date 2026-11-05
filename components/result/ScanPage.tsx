import React from 'react';
import { IdentifyResponse, Language, UserContext } from '../../types';
import { t, tf } from '../../utils/i18n';
import { QUIZ_MAX_POINTS } from '../../museums/scoring';
import type { SavedNarration } from '../../hooks/useNarration';
import { NarrationPanel } from './NarrationPanel';
import { AiTracePanel } from '../game/AiTracePanel';
import { ChatIcon, QuizIcon, ShareIcon, ScanIcon, SparkIcon } from '../game/icons';

export interface SheetPage {
  /** 'current' for the scan just made, otherwise the history scan id. */
  key: string;
  data: IdentifyResponse;
  imageUrl: string | null;
  scanId: string | null;
}

interface ScanPageProps {
  page: SheetPage;
  language: Language;
  userContext: UserContext;
  isDeepAnalyzing: boolean;
  hasSelfie: boolean;
  onOpenChat: () => void;
  onOpenQuiz: () => void;
  onShare: () => void;
  onGenerateMe?: () => void;
  onScanAnother: () => void;
}

const personaLabel = (persona: string, language: Language) =>
  t(persona === 'academic' ? 'result.curator' : persona === 'blogger' ? 'result.blogger' : 'result.guide', language);

/** Everything about one scan: photo, title, narration, actions, analysis and "How the AI thought". */
export const ScanPage: React.FC<ScanPageProps> = ({
  page, language, userContext, isDeepAnalyzing, hasSelfie,
  onOpenChat, onOpenQuiz, onShare, onGenerateMe, onScanAnother,
}) => {
  const { data } = page;
  const saved: SavedNarration | undefined = data.narration;

  return (
    <article className="scan-article px-5 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
      {/* At the medium detent the photo sits above the sheet; it grows into the sheet as it reaches full */}
      {page.imageUrl && (
        <div className="sheet-hero" aria-hidden="true">
          <img
            src={page.imageUrl}
            alt=""
            draggable={false}
            className="w-full h-full object-contain rounded-2xl bg-[var(--bg)]"
          />
        </div>
      )}

      <header className="pt-1">
        <h2 className="font-serif text-[1.75rem] leading-tight text-[var(--text)] tracking-tight">{data.title}</h2>
        <p className="text-secondary text-base mt-1">{[data.artist, data.year].filter(Boolean).join(', ')}</p>
        {(data.style || data.country) && (
          <p className="text-sm text-secondary mt-1">{[data.style, data.country].filter(Boolean).join(' · ')}</p>
        )}
      </header>

      <div className="border-b border-white/[0.08]">
        <NarrationPanel
          pageKey={page.key}
          saved={saved}
          meta={{ title: data.title, artist: data.artist, artworkUrl: page.imageUrl && !page.imageUrl.startsWith('data:') ? page.imageUrl : null }}
          language={language}
        />
      </div>

      <div className="pt-5 flex flex-col gap-3">
        <button
          type="button"
          onClick={onOpenChat}
          className="w-full min-h-[52px] rounded-full bg-primary-dark text-onPrimary font-medium text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <ChatIcon className="w-5 h-5" />
          {t('result.chatWith', language)} {personaLabel(userContext.persona, language)}
        </button>
        <button
          type="button"
          onClick={onOpenQuiz}
          disabled={!page.scanId}
          className="w-full min-h-[48px] px-5 rounded-full border border-primary/30 text-[var(--text)] text-sm flex items-center justify-between gap-3 active:bg-primary/10 transition-colors disabled:opacity-50"
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <QuizIcon className="w-5 h-5 text-primary" />
            {t('quiz.cta', language)}
          </span>
          {page.scanId ? (
            <span className="font-mono tabular text-xs text-secondary whitespace-nowrap">{tf('quiz.ctaPoints', language, { points: QUIZ_MAX_POINTS })}</span>
          ) : (
            <span className="text-xs text-secondary whitespace-nowrap">{t('quiz.saving', language)}</span>
          )}
        </button>
        <div className={`grid gap-3 ${onGenerateMe && hasSelfie ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {onGenerateMe && hasSelfie && (
            <ActionButton label={t('generate.button', language)} onClick={onGenerateMe}><SparkIcon className="w-5 h-5" /></ActionButton>
          )}
          <ActionButton label={t('result.share', language)} onClick={onShare}><ShareIcon className="w-5 h-5" /></ActionButton>
          <ActionButton label={t('result.scanAnother', language)} onClick={onScanAnother}><ScanIcon className="w-5 h-5" /></ActionButton>
        </div>
      </div>

      {data.description && <p className="pt-6 text-base text-[var(--text)]/85 leading-relaxed max-w-[65ch] selectable">{data.description}</p>}

      {data.funFact && (
        <section className="pt-6">
          <h3 className="text-base font-medium text-[var(--text)]">{t('result.didYouKnow', language)}</h3>
          <p className="mt-1 text-base text-[var(--text)]/80 leading-relaxed max-w-[65ch] selectable">{data.funFact}</p>
        </section>
      )}

      {data.deepAnalysis ? (
        <div className="pt-2">
          {data.deepAnalysis.curiosities?.length > 0 && (
            <Section title={t('result.uniqueInsights', language)}>
              <ul className="space-y-2">
                {data.deepAnalysis.curiosities.map((c, i) => <li key={i} className="leading-relaxed">{c}</li>)}
              </ul>
            </Section>
          )}
          <Section title={t('result.historicalContext', language)}>{data.deepAnalysis.historicalContext}</Section>
          {data.deepAnalysis.technicalAnalysis && <Section title={t('result.technique', language)}>{data.deepAnalysis.technicalAnalysis}</Section>}
          <Section title={t('result.symbolism', language)}>{data.deepAnalysis.symbolism}</Section>
        </div>
      ) : isDeepAnalyzing && page.key === 'current' ? (
        <p className="pt-6 text-sm text-secondary">{t('result.uncovering', language)}</p>
      ) : null}

      <AiTracePanel trace={data.aiTrace} sources={data.sources} language={language} />
    </article>
  );
};

const ActionButton: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-[64px] rounded-2xl bg-[var(--surface-variant)] text-[var(--text)] text-xs flex flex-col items-center justify-center gap-1.5 px-2 text-center active:scale-[0.98] transition-transform"
  >
    {children}
    <span className="leading-tight">{label}</span>
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="pt-6">
    <h3 className="text-base font-medium text-[var(--text)]">{title}</h3>
    <div className="mt-1 text-base text-[var(--text)]/80 leading-relaxed max-w-[65ch] selectable">{children}</div>
  </section>
);
