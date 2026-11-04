import React, { useCallback, useEffect, useState } from 'react';
import { Language } from '../../types';
import { t, tf } from '../../utils/i18n';
import { fetchLeaderboard, Leaderboard, LeaderboardEntry } from '../../services/gameApi';
import { RefreshIcon } from './icons';
import { PanelShell, LoadError } from './MissionsPanel';

const AUTO_REFRESH_MS = 30_000;

interface RankingPanelProps {
  language: Language;
  refreshKey: number;
}

export const RankingPanel: React.FC<RankingPanelProps> = ({ language, refreshKey }) => {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(false);
    fetchLeaderboard()
      .then(setBoard)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const you = board?.you;
  const youInList = board?.entries.some((e) => e.isYou);

  return (
    <PanelShell>
      <header className="pt-12 pb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[var(--text)] tracking-tight">{t('ranking.title', language)}</h1>
          <p className="text-secondary mt-2 tabular" aria-live="polite">
            {!board
              ? t('common.loading', language)
              : you
                ? tf('ranking.yourPosition', language, { rank: you.rank, total: board.totalPlayers })
                : t('ranking.notYet', language)}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          aria-label={t('ranking.refresh', language)}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-secondary hover:text-[var(--text)] bg-[var(--surface)]"
        >
          <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {error && <LoadError language={language} onRetry={load} />}

      {board && board.entries.length === 0 && (
        <p className="py-6 border-y border-white/[0.08] text-sm text-secondary">{t('ranking.empty', language)}</p>
      )}

      {board && board.entries.length > 0 && (
        <ol className="border-t border-white/[0.08]">
          {board.entries.map((entry, i) => (
            <RankRow key={`${entry.rank}-${entry.name}-${i}`} entry={entry} language={language} />
          ))}
          {you && !youInList && (
            <>
              <li aria-hidden="true" className="py-2 text-center text-secondary tracking-[0.3em]">···</li>
              <RankRow entry={{ ...you, name: t('ranking.you', language), isYou: true }} language={language} />
            </>
          )}
        </ol>
      )}
    </PanelShell>
  );
};

const RankRow: React.FC<{ entry: LeaderboardEntry; language: Language }> = ({ entry, language }) => (
  <li
    className={`flex items-center gap-4 py-3.5 border-b border-white/[0.08] ${entry.isYou ? 'bg-[var(--primary-dim)]' : ''}`}
    aria-current={entry.isYou ? 'true' : undefined}
  >
    <span className={`w-8 text-right font-mono tabular text-base ${entry.rank <= 3 ? 'text-[var(--text)]' : 'text-secondary'}`}>
      {entry.rank}
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-base text-[var(--text)] truncate">
        {entry.name}
        {entry.isYou && <span className="text-primary text-sm"> · {t('ranking.you', language)}</span>}
      </p>
      <p className="text-xs text-secondary mt-0.5 tabular">{entry.missions === 1 ? t('ranking.missionsCountOne', language) : tf('ranking.missionsCount', language, { n: entry.missions })}</p>
    </div>
    <span className="flex items-baseline gap-1">
      <span className="font-mono tabular text-base text-[var(--text)]">{entry.points}</span>
      <span className="text-secondary text-xs">{t('points.unit', language)}</span>
    </span>
  </li>
);
