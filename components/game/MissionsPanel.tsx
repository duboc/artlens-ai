import React, { useCallback, useEffect, useState } from 'react';
import { Language } from '../../types';
import { t, tf } from '../../utils/i18n';
import { getMuseum } from '../../museums';
import { fetchMissions, MissionsState } from '../../services/gameApi';
import { StatusPip, ScanIcon } from './icons';
import { BOTTOM_NAV_HEIGHT } from './BottomNav';
import { POINTS } from '../../museums/scoring';


interface MissionsPanelProps {
  language: Language;
  /** Bump to refetch (e.g. after a scan awarded points). */
  refreshKey: number;
  onLoaded?: (state: MissionsState) => void;
  onGoScan: () => void;
}

export const MissionsPanel: React.FC<MissionsPanelProps> = ({ language, refreshKey, onLoaded, onGoScan }) => {
  const museum = getMuseum();
  const [state, setState] = useState<MissionsState | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetchMissions()
      .then((s) => { setState(s); onLoaded?.(s); })
      .catch(() => setError(true));
  }, [onLoaded]);

  useEffect(load, [refreshKey, load]);

  const statusById = new Map((state?.missions || []).map((m) => [m.id, m]));
  const done = state ? state.missions.filter((m) => m.completed).length : 0;

  return (
    <PanelShell>
      <header className="pt-12 pb-6">
        <h1 className="font-serif text-3xl text-[var(--text)] tracking-tight">{t('missions.title', language)}</h1>
        <p className="text-secondary mt-2 tabular" aria-live="polite">
          {state
            ? tf('missions.summary', language, { done, total: museum.missions.length, points: state.points })
            : t('common.loading', language)}
        </p>
      </header>

      <p className="text-sm text-[var(--text)]/80 leading-relaxed max-w-[60ch]">{t('missions.intro', language)}</p>
      <p className="text-xs text-secondary mt-2">
        {tf('missions.scoring', language, { artwork: POINTS.newArtwork, quiz: POINTS.quizCorrect })}
      </p>

      {error && <LoadError language={language} onRetry={load} />}

      <ol className="mt-8 border-t border-white/[0.08]">
        {museum.missions.map((mission) => {
          const status = statusById.get(mission.id);
          const isDone = !!status?.completed;
          return (
            <li key={mission.id} className="py-4 border-b border-white/[0.08] flex gap-4 items-start">
              <StatusPip done={isDone} label={t(isDone ? 'missions.statusDone' : 'missions.statusOpen', language)} />
              <div className="flex-1 min-w-0">
                <p className={`text-base font-medium leading-snug ${isDone ? 'text-[var(--text)]/70' : 'text-[var(--text)]'}`}>
                  {mission.title[language]}
                </p>
                <p className="text-sm text-secondary mt-1 leading-snug">
                  {isDone && status?.completedWith
                    ? <>{t('missions.completedWith', language)}: <span className="text-[var(--text)]/80">{status.completedWith}</span></>
                    : mission.hint[language]}
                </p>
              </div>
              <span className={`font-mono text-sm tabular pt-0.5 ${isDone ? 'text-primary' : 'text-secondary'}`}>
                +{mission.points}
              </span>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={onGoScan}
        className="mt-8 w-full min-h-[48px] rounded-full bg-primary-dark text-onPrimary font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <ScanIcon className="w-5 h-5" />
        {t('nav.scan', language)}
      </button>
    </PanelShell>
  );
};

/** Full-height panel above the camera, padded above the bottom nav. */
export const PanelShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="absolute inset-0 z-30 bg-[var(--bg)] overflow-y-auto no-scrollbar">
    <div className="max-w-lg mx-auto px-6 pt-safe" style={{ paddingBottom: BOTTOM_NAV_HEIGHT + 48 }}>
      {children}
    </div>
  </div>
);

export const LoadError: React.FC<{ language: Language; onRetry: () => void }> = ({ language, onRetry }) => (
  <div role="alert" className="mt-6 flex items-center justify-between gap-4 py-3 border-y border-error/30">
    <p className="text-sm text-[var(--text)]/90">{t('common.error', language)}</p>
    <button type="button" onClick={onRetry} className="text-sm font-medium text-primary px-3 min-h-[44px]">
      {t('common.retry', language)}
    </button>
  </div>
);
