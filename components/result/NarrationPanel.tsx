import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { MEDIUM_FRACTION } from '../sheet/sheetPhysics';
import { Language } from '../../types';
import { t } from '../../utils/i18n';
import type { UseNarrationReturn, SavedNarration, NarrationMeta } from '../../hooks/useNarration';
import { useNarrationState } from '../../hooks/NarrationProvider';
import type { NarrationSentence } from '../../utils/narrationTimeline';
import { PlayIcon, PauseIcon, ReplayIcon } from '../game/icons';

interface NarrationPanelProps {
  /** 'current' for the scan just made, otherwise the history scan id. */
  pageKey: string;
  /** Defaults to the app's narration engine (NarrationProvider); tests pass one directly. */
  engine?: UseNarrationReturn;
  /** Saved narration for history scans (absent for the live scan until it is saved). */
  saved?: SavedNarration;
  meta: NarrationMeta;
  language: Language;
}

/** Narration text that follows the voice, with pause / resume / listen again and a "read only" mode. */
export const NarrationPanel: React.FC<NarrationPanelProps> = ({ pageKey, engine: engineProp, saved, meta, language }) => {
  const fromContext = useNarrationState();
  const engine = engineProp ?? fromContext;
  const windowRef = useRef<HTMLDivElement>(null);
  const activeIdx = engine && engine.sourceKey === pageKey && engine.mode !== 'read' ? engine.activeSentence : -1;

  const sentenceCount = engine ? (engine.sourceKey === pageKey ? engine.sentences.length : saved?.sentences.length ?? 0) : 0;

  // At the medium detent the text is a window of up to 3 lines that must fit above the bottom
  // edge (small phones get fewer lines): measure where it sits inside the sheet
  useLayoutEffect(() => {
    const win = windowRef.current;
    const sheet = win?.closest('.result-sheet') as HTMLElement | null;
    if (!win || !sheet) return;
    const fit = () => {
      const lineH = parseFloat(getComputedStyle(win).lineHeight) || 28;
      const offsetInSheet = win.getBoundingClientRect().top - sheet.getBoundingClientRect().top;
      const available = window.innerHeight * (1 - MEDIUM_FRACTION) - offsetInSheet - 8;
      const lines = Math.max(1, Math.min(3, Math.floor(available / lineH)));
      win.style.setProperty('--caption-lines', String(lines));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [sentenceCount]);

  // Keep the spoken sentence inside that window
  useEffect(() => {
    const win = windowRef.current;
    if (!win || activeIdx < 0 || win.scrollHeight <= win.clientHeight) return;
    const span = win.querySelector<HTMLElement>(`[data-sentence="${activeIdx}"]`);
    if (!span) return;
    const lineH = parseFloat(getComputedStyle(win).lineHeight) || 28;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    win.scrollTo({ top: Math.max(0, span.offsetTop - win.offsetTop - lineH * 0.25), behavior: reduce ? 'auto' : 'smooth' });
  }, [activeIdx]);

  if (!engine) return null;
  const isLiveScan = pageKey === 'current';
  const owns = engine.sourceKey === pageKey;
  const readOnly = engine.mode === 'read';

  // What to show: the engine's text when it holds this scan, else the saved text
  const sentences: NarrationSentence[] = owns ? engine.sentences : saved?.sentences ?? [];
  const script = owns ? engine.script : saved?.script ?? null;
  const active = owns && !readOnly ? engine.activeSentence : -1;
  const preparing = owns && engine.status === 'connecting';
  const hasAudio = owns ? engine.status === 'streaming' || engine.status === 'finished' : !!saved;

  if (!isLiveScan && !saved) {
    return <p className="text-sm text-secondary py-2">{t('narration.none', language)}</p>;
  }
  if (isLiveScan && !owns && !saved) return null;

  const onPrimary = () => {
    if (!owns && saved) {
      engine.playSaved(pageKey, saved, meta);
      return;
    }
    if (engine.isPlaying) engine.pause();
    else if (engine.isPaused) engine.resume();
    else engine.replay(0);
  };

  const primaryLabel = owns && engine.isPlaying
    ? t('narration.pause', language)
    : owns && engine.isPaused
      ? t('narration.resume', language)
      : owns && engine.status === 'finished'
        ? t('narration.replay', language)
        : t('narration.play', language);
  const PrimaryIcon = owns && engine.isPlaying ? PauseIcon : owns && engine.status === 'finished' && !engine.isPaused ? ReplayIcon : PlayIcon;

  return (
    <section aria-label={t('narration.title', language)} className="py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrimary}
          disabled={preparing || (!hasAudio && !saved) || (readOnly && owns && engine.status === 'streaming')}
          aria-label={primaryLabel}
          aria-busy={preparing || undefined}
          className={`w-12 h-12 shrink-0 rounded-full bg-primary-dark text-onPrimary flex items-center justify-center active:scale-95 transition-transform ${preparing ? 'disabled:opacity-70' : 'disabled:opacity-40'}`}
        >
          {preparing
            ? <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
            : <PrimaryIcon className="w-5 h-5" />}
        </button>
        {owns && engine.isPaused && (
          <button
            type="button"
            onClick={() => engine.replay(0)}
            aria-label={t('narration.replay', language)}
            className="w-11 h-11 shrink-0 rounded-full bg-[var(--surface-variant)] text-[var(--text)] flex items-center justify-center active:scale-95 transition-transform"
          >
            <ReplayIcon className="w-5 h-5" />
          </button>
        )}
        <div
          className="ml-auto flex rounded-full bg-[var(--surface-variant)] p-0.5"
          role="radiogroup"
          aria-label={t('narration.mode', language)}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
            e.preventDefault();
            const next = engine.mode === 'listen' ? 'read' : 'listen';
            engine.setMode(next);
            (e.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLElement | null)?.focus();
          }}
        >
          {(['listen', 'read'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={engine.mode === m}
              tabIndex={engine.mode === m ? 0 : -1}
              data-mode={m}
              onClick={() => engine.setMode(m)}
              className={`min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors ${engine.mode === m ? 'bg-[var(--surface)] text-[var(--text)]' : 'text-secondary'}`}
            >
              {m === 'listen' ? t('narration.listen', language) : t('narration.readOnly', language)}
            </button>
          ))}
        </div>
      </div>

      <div ref={windowRef} className="caption-window mt-4 text-lg leading-relaxed max-w-[60ch] selectable no-scrollbar" aria-live="off">
        {preparing && !script && <p className="text-secondary text-base">{t('narration.preparing', language)}</p>}
        {sentences.length > 0
          ? sentences.map((s, i) => {
              const pending = !Number.isFinite(s.start);
              const state = active === i ? 'now' : readOnly || active > i || (!owns && !engine.isPlaying) ? 'read' : pending || i > active ? 'next' : 'read';
              return (
                <span
                  key={i}
                  data-sentence={i}
                  aria-current={state === 'now' ? 'true' : undefined}
                  className={`transition-colors duration-200 rounded-md ${state === 'now' ? 'text-[var(--text)] bg-primary/25 box-decoration-clone px-1 -mx-1' : state === 'next' ? 'text-secondary' : 'text-[var(--text)]/75'}`}
                >
                  {s.text}{' '}
                </span>
              );
            })
          : script && <span className="text-[var(--text)]/85">{script}</span>}
      </div>
    </section>
  );
};
