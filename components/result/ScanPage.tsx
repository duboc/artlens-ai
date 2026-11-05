import React from 'react';
import { IdentifyResponse, Language, ScanActivity, UserContext } from '../../types';
import { t, tf } from '../../utils/i18n';
import { QUIZ_MAX_POINTS } from '../../museums/scoring';
import type { SavedNarration } from '../../hooks/useNarration';
import { NarrationPanel } from './NarrationPanel';
import { AiTracePanel } from '../game/AiTracePanel';
import { ChatIcon, QuizIcon, ShareIcon, ScanIcon, SparkIcon, LandmarkIcon, BrushIcon, EyeIcon } from '../game/icons';
import { oneParagraph } from '../../utils/text';

export interface SheetPage {
  /** 'current' for the scan just made, otherwise the history scan id. */
  key: string;
  data: IdentifyResponse;
  imageUrl: string | null;
  scanId: string | null;
  /** What the visitor already did with this artwork (chat messages, quiz answers). */
  activity?: ScanActivity;
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
  const chatCount = page.activity?.chatMessages ?? 0;
  const quiz = page.activity?.quiz;
  // Generated text is kept to one short paragraph per block (older scans stored long text)
  const description = oneParagraph(data.description, 320);
  const funFact = oneParagraph(data.funFact, 220);
  const deep = data.deepAnalysis;
  const curiosities = (deep?.curiosities ?? []).slice(0, 4).map((c) => oneParagraph(c, 140)).filter(Boolean);
  const context = oneParagraph(deep?.historicalContext, 260);
  const technique = oneParagraph(deep?.technicalAnalysis, 260);
  const symbolism = oneParagraph(deep?.symbolism, 260);
  const quizLabel = !quiz || quiz.answered === 0
    ? t('quiz.cta', language)
    : quiz.answered < quiz.total ? t('quiz.ctaResume', language) : t('quiz.ctaReview', language);

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

      {/* Actions: one shape for every button (52px pill, content centered) */}
      <div className="pt-5 flex flex-col gap-3">
        <PillButton variant="primary" onClick={onOpenChat} icon={<ChatIcon className="w-5 h-5" />}
          meta={chatCount > 0 ? tf(chatCount === 1 ? 'result.chatMessagesOne' : 'result.chatMessages', language, { n: chatCount }) : undefined}>
          {chatCount > 0 ? t('result.chatContinue', language) : `${t('result.chatWith', language)} ${personaLabel(userContext.persona, language)}`}
        </PillButton>
        <PillButton variant="secondary" onClick={onOpenQuiz} disabled={!page.scanId} icon={<QuizIcon className="w-5 h-5 text-primary" />}
          meta={!page.scanId
            ? t('quiz.saving', language)
            : quiz && quiz.answered > 0
              ? tf('quiz.ctaScore', language, { correct: quiz.correct, answered: quiz.answered, total: quiz.total })
              : tf('quiz.ctaPoints', language, { points: QUIZ_MAX_POINTS })}>
          {quizLabel}
        </PillButton>
        {onGenerateMe && hasSelfie && (
          <PillButton variant="tonal" onClick={onGenerateMe} icon={<SparkIcon className="w-5 h-5" />}>{t('generate.button', language)}</PillButton>
        )}
        <div className="grid grid-cols-2 gap-3">
          <PillButton variant="tonal" onClick={onShare} icon={<ShareIcon className="w-5 h-5" />}>{t('result.share', language)}</PillButton>
          <PillButton variant="tonal" onClick={onScanAnother} icon={<ScanIcon className="w-5 h-5" />}>{t('result.scanAnother', language)}</PillButton>
        </div>
      </div>

      {/* About the work: one short paragraph, then compact cards */}
      {description && <p className="pt-7 text-base text-[var(--text)]/85 leading-relaxed max-w-[65ch] selectable">{description}</p>}

      {(funFact || deep || (isDeepAnalyzing && page.key === 'current')) && (
        <div className="pt-6 flex flex-col gap-3" aria-label={t('result.aboutWork', language)}>
          {funFact && (
            <Card tone="highlight" icon={<SparkIcon className="w-5 h-5 text-primary" />} title={t('result.didYouKnow', language)}>{funFact}</Card>
          )}
          {deep ? (
            <>
              {curiosities.length > 0 && (
                <section aria-label={t('result.uniqueInsights', language)}>
                  <h3 className="pt-3 pb-2 text-base font-medium text-[var(--text)]">{t('result.uniqueInsights', language)}</h3>
                  <ol className="grid grid-cols-2 gap-3">
                    {curiosities.map((c, i) => (
                      <li key={i} className={`rounded-2xl bg-[var(--surface-variant)] p-4 ${curiosities.length % 2 === 1 && i === curiosities.length - 1 ? 'col-span-2' : ''}`}>
                        <span className="block font-mono tabular text-sm text-primary">{String(i + 1).padStart(2, '0')}</span>
                        <p className="mt-1.5 text-sm text-[var(--text)]/90 leading-snug selectable">{c}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {context && <Card icon={<LandmarkIcon className="w-5 h-5 text-primary" />} title={t('result.historicalContext', language)}>{context}</Card>}
              {technique && <Card icon={<BrushIcon className="w-5 h-5 text-primary" />} title={t('result.technique', language)}>{technique}</Card>}
              {symbolism && <Card icon={<EyeIcon className="w-5 h-5 text-primary" />} title={t('result.symbolism', language)}>{symbolism}</Card>}
            </>
          ) : (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label={t('result.uncovering', language)}>
              <p className="text-sm text-secondary">{t('result.uncovering', language)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-2xl bg-[var(--surface-variant)] animate-pulse" />
                <div className="h-24 rounded-2xl bg-[var(--surface-variant)] animate-pulse" />
              </div>
              <div className="h-20 rounded-2xl bg-[var(--surface-variant)] animate-pulse" />
            </div>
          )}
        </div>
      )}

      <AiTracePanel trace={data.aiTrace} sources={data.sources} language={language} />
    </article>
  );
};

type PillVariant = 'primary' | 'secondary' | 'tonal';
const PILL: Record<PillVariant, string> = {
  primary: 'bg-primary-dark text-onPrimary font-medium',
  secondary: 'border border-primary/40 text-[var(--text)] active:bg-primary/10',
  tonal: 'bg-[var(--surface-variant)] text-[var(--text)]',
};

/** The one button shape of the sheet: 52px pill, icon + label (+ optional mono meta) centered. */
const PillButton: React.FC<{
  variant: PillVariant; onClick: () => void; icon: React.ReactNode; meta?: string; disabled?: boolean; children: React.ReactNode;
}> = ({ variant, onClick, icon, meta, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-h-[52px] px-4 rounded-full text-base flex items-center justify-center gap-2 text-center active:scale-[0.98] transition-transform disabled:opacity-50 ${PILL[variant]}`}
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{children}</span>
    {meta && <span className={`shrink-0 font-mono tabular text-sm ${variant === 'primary' ? 'opacity-90' : 'text-secondary'}`}>· {meta}</span>}
  </button>
);

/** A compact content card: icon + title, then one short paragraph. */
const Card: React.FC<{ icon: React.ReactNode; title: string; tone?: 'plain' | 'highlight'; children: React.ReactNode }> = ({ icon, title, tone = 'plain', children }) => (
  <section className={`rounded-2xl p-4 ${tone === 'highlight' ? 'bg-primary/[0.12]' : 'bg-[var(--surface-variant)]'}`}>
    <h3 className="flex items-center gap-2 text-base font-medium text-[var(--text)]">{icon}{title}</h3>
    <p className="mt-1.5 text-[15px] text-[var(--text)]/85 leading-relaxed max-w-[65ch] selectable">{children}</p>
  </section>
);
