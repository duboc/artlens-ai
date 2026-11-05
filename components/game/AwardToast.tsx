import React, { useEffect } from 'react';
import { Language, ScanAwards } from '../../types';
import { t } from '../../utils/i18n';
import { getMuseum } from '../../museums';
import { POINTS } from '../../museums/scoring';
import { ArrowRightIcon } from './icons';

const VISIBLE_MS = 6000;

interface AwardToastProps {
  awards: ScanAwards;
  /** Render in the flow of its container (e.g. under the result sheet's handle) instead of floating. */
  inline?: boolean;
  language: Language;
  onDismiss: () => void;
  onViewMissions: () => void;
}

/** Quiet "what you earned" note after a scan; links to Missions when one was completed. */
export const AwardToast: React.FC<AwardToastProps> = ({ awards, inline = false, language, onDismiss, onViewMissions }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [awards, onDismiss]);

  const missions = getMuseum().missions;
  const lines = [
    ...(awards.newArtwork ? [{ label: t('awards.newArtwork', language), points: POINTS.newArtwork }] : []),
    ...awards.missions.map((m) => ({
      label: `${t('awards.mission', language)}: ${missions.find((x) => x.id === m.id)?.title[language] ?? m.id}`,
      points: m.points,
    })),
  ];

  // In the result sheet: one 44px line in the header's left slot (no layout shift, never over
  // the title or the audio controls). Tapping it opens Missions when one was completed.
  if (inline) {
    const summary = lines.map((l) => l.label).join(' · ');
    const body = (
      <>
        <span className="font-mono tabular text-base text-primary shrink-0">+{awards.points}</span>
        <span className="truncate text-sm text-[var(--text)]">{summary}</span>
        {awards.missions.length > 0 && <ArrowRightIcon className="w-4 h-4 text-primary shrink-0" />}
      </>
    );
    return (
      <div role="status" aria-live="polite" className="award-toast min-w-0 flex-1">
        {awards.missions.length > 0 ? (
          <button
            type="button"
            onClick={onViewMissions}
            className="min-h-[44px] max-w-full flex items-center gap-2 text-left"
          >
            {body}
            <span className="sr-only">{t('awards.viewMissions', language)}</span>
          </button>
        ) : (
          <p className="min-h-[44px] flex items-center gap-2">{body}</p>
        )}
      </div>
    );
  }

  const card = (
      <div
        role="status"
        aria-live="polite"
        className="award-toast max-w-lg mx-auto bg-[var(--surface)] border border-white/[0.08] rounded-2xl px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)] pointer-events-auto"
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-mono tabular text-2xl text-primary">+{awards.points}</p>
          <button type="button" onClick={onDismiss} className="text-sm text-secondary min-h-[44px] min-w-[44px] px-2 -mr-2">
            {t('common.close', language)}
          </button>
        </div>
        <ul className="mt-1 space-y-0.5">
          {lines.map((line, i) => (
            <li key={i} className="flex justify-between gap-3 text-sm text-[var(--text)]">
              <span className="truncate">{line.label}</span>
              <span className="font-mono tabular text-secondary">+{line.points}</span>
            </li>
          ))}
        </ul>
        {awards.missions.length > 0 && (
          <button
            type="button"
            onClick={onViewMissions}
            className="mt-2 min-h-[44px] text-sm font-medium text-primary flex items-center gap-1.5"
          >
            {t('awards.viewMissions', language)}
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>
  );

  return (
    <div className="absolute inset-x-0 top-0 z-50 px-4 pointer-events-none" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)' }}>
      {card}
    </div>
  );
};
