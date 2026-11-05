import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Language, UserContext } from '../../types';
import { t, tf } from '../../utils/i18n';
import { useNarrationActions, useNarrationState } from '../../hooks/NarrationProvider';
import { ScanPage, SheetPage } from './ScanPage';
import { ChatWindow } from '../ChatWindow';
import { preWarmAudio } from '../../hooks/useGeminiLive';
import { QuizPanel } from '../game/QuizPanel';
import { CrossIcon } from '../game/icons';
import {
  Detent,
  chooseDetent,
  constrainDrag,
  detentOffsets,
  releaseVelocity,
  springSettled,
  springStep,
} from '../sheet/sheetPhysics';

interface ResultSheetProps {
  /** pages[0] is the scan just made; the rest are earlier scans (swipe sideways). */
  pages: SheetPage[];
  language: Language;
  userContext: UserContext;
  isDeepAnalyzing: boolean;
  hasSelfie: boolean;
  /** Slide up from the bottom; false when a view transition already morphs the photo into place. */
  animateIn: boolean;
  /** Index of the page in view (the photo above the sheet follows it). */
  onActiveChange?: (index: number) => void;
  /** Inline notice (e.g. points earned): takes the header's left slot for a few seconds, never over content. */
  toast?: React.ReactNode;
  onClosed: () => void;
  onImmersiveChange?: (immersive: boolean) => void;
  onPointsChange?: (total: number) => void;
  onPersonaChange?: (persona: 'guide' | 'academic' | 'blogger') => void;
  onGenerateMe?: () => void;
  onShare: (page: SheetPage) => void;
}

type View = { kind: 'chat' | 'quiz'; pageIndex: number } | null;

interface Gesture {
  x0: number;
  y0: number;
  yStart: number;
  axis: 'x' | 'y' | null;
  dragging: boolean;
  fromHeader: boolean;
  scroller: HTMLElement | null;
  samples: { t: number; y: number }[];
}

const viewportHeight = () => (typeof window !== 'undefined' ? window.innerHeight : 800);

/** Native-feeling result sheet: follows the finger, settles on medium/full with a spring, pull down to close. */
export const ResultSheet: React.FC<ResultSheetProps> = ({
  pages, language, userContext, isDeepAnalyzing, hasSelfie, animateIn, onActiveChange, toast,
  onClosed, onImmersiveChange, onPointsChange, onPersonaChange, onGenerateMe, onShare,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const yRef = useRef(animateIn ? viewportHeight() : detentOffsets(viewportHeight()).medium);
  const rafRef = useRef<number | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const ignorePopRef = useRef(0);
  /** History entries this sheet pushed and has not popped yet. */
  const pushedRef = useRef(0);
  const closingRef = useRef(false);
  const unmountTimerRef = useRef<number | null>(null);
  const [vh, setVh] = useState(viewportHeight);
  /** Current detent. Written to `data-detent` directly (CSS reacts to it): no React render on release. */
  const detentRef = useRef<Detent>('medium');
  const setDetent = useCallback((d: Detent) => {
    detentRef.current = d;
    sheetRef.current?.setAttribute('data-detent', d);
  }, []);
  const [view, setView] = useState<View>(null);
  const viewRef = useRef<View>(null);
  const [active, setActive] = useState(0);
  const narration = useNarrationActions();

  // ─── Rendering the position (transform only: no layout, no React render per frame) ──

  /** The photo above the sheet (CameraFeed's stage); it rises with the sheet. */
  const stageRef = useRef<HTMLElement | null>(null);

  const apply = useCallback((y: number) => {
    yRef.current = y;
    const el = sheetRef.current;
    if (!el) return;
    const medium = detentOffsets(window.innerHeight).medium;
    const full = Math.max(0, Math.min(1, 1 - y / medium));
    el.style.transform = `translate3d(0, ${y}px, 0)`;
    el.style.setProperty('--sheet-full', full.toFixed(3));
    // Above medium the photo moves up with the sheet's top edge, so it is pushed away rather than
    // covered (compositor-only, like the sheet itself)
    if (!stageRef.current?.isConnected) stageRef.current = document.querySelector<HTMLElement>('.photo-stage');
    if (stageRef.current) stageRef.current.style.transform = `translate3d(0, ${Math.min(0, y - medium)}px, 0)`;
  }, []);

  useEffect(() => () => {
    // Leave the camera layer as we found it
    if (stageRef.current) stageRef.current.style.transform = '';
  }, []);

  const finish = useCallback((target: Detent) => {
    if (target === 'closed') {
      closingRef.current = true;
      onClosed();
      return;
    }
    setDetent(target);
  }, [onClosed, setDetent]);

  const animateTo = useCallback((target: Detent, velocity = 0) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const to = detentOffsets(window.innerHeight)[target];
    if (target !== 'closed') {
      setDetent(target);
    }
    let state = { x: yRef.current, v: velocity };
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      state = springStep(state, to, dt);
      if (springSettled(state, to)) {
        apply(to);
        rafRef.current = null;
        finish(target);
        return;
      }
      apply(state.x);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [apply, finish, setDetent]);

  // Initial position + entrance
  useLayoutEffect(() => {
    setDetent(detentRef.current);
    apply(yRef.current);
    if (animateIn) animateTo('medium');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => {
      setVh(window.innerHeight);
      apply(detentOffsets(window.innerHeight)[detentRef.current]);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [apply]);

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  // ─── History API: system back closes the chat/quiz, then the sheet ────────

  const push = (state: 'sheet' | 'view') => {
    history.pushState({ artlens: state }, '');
    pushedRef.current++;
  };

  /** Pop `n` of our own entries without reacting to the resulting popstate. */
  const goBack = (n: number) => {
    if (n <= 0) return;
    pushedRef.current -= n;
    ignorePopRef.current++;
    history.go(-n);
  };

  const close = useCallback((fromPop = false) => {
    if (closingRef.current) return;
    if (!fromPop) goBack(pushedRef.current);
    viewRef.current = null;
    animateTo('closed');
  }, [animateTo]);

  const closeView = useCallback((fromPop = false) => {
    if (!viewRef.current) return;
    viewRef.current = null;
    setView(null);
    if (!fromPop) goBack(1);
  }, []);

  const openView = useCallback((kind: 'chat' | 'quiz', pageIndex: number) => {
    if (kind === 'chat') {
      if (narration.isPlaying()) narration.pause();
      preWarmAudio();
    }
    const next = { kind, pageIndex };
    viewRef.current = next;
    setView(next);
    push('view');
    animateTo('full');
  }, [animateTo, narration]);

  useEffect(() => {
    // StrictMode runs cleanup + effect again on the same instance: keep the entry we already pushed
    if (unmountTimerRef.current !== null) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    } else {
      push('sheet');
    }
    const onPop = () => {
      if (ignorePopRef.current > 0) {
        ignorePopRef.current--;
        return;
      }
      pushedRef.current = Math.max(0, pushedRef.current - 1);
      if (viewRef.current) closeView(true);
      else close(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewRef.current) closeView();
      else close();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      // Leave history as we found it if we unmount without a back navigation. Deferred so a
      // StrictMode remount (same instance, effect runs again right away) can cancel it.
      unmountTimerRef.current = window.setTimeout(() => {
        unmountTimerRef.current = null;
        if (pushedRef.current > 0) {
          const n = pushedRef.current;
          pushedRef.current = 0;
          history.go(-n);
        }
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { onImmersiveChange?.(!!view); }, [view, onImmersiveChange]);
  useEffect(() => () => onImmersiveChange?.(false), [onImmersiveChange]);

  // ─── Touch: vertical drags move the sheet; horizontal swipes page between scans ──

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (viewRef.current || e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const touch = e.touches[0];
      gestureRef.current = {
        x0: touch.clientX,
        y0: touch.clientY,
        yStart: yRef.current,
        axis: null,
        dragging: false,
        fromHeader: !!target.closest('[data-sheet-header]'),
        scroller: target.closest('[data-sheet-scroller]') as HTMLElement | null,
        samples: [{ t: performance.now(), y: yRef.current }],
      };
    };

    const onMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const touch = e.touches[0];
      const dx = touch.clientX - g.x0;
      const dy = touch.clientY - g.y0;
      if (!g.axis) {
        const atTop = !g.scroller || g.scroller.scrollTop <= 0;
        // Decide on the very first move when pulling down at the top of the content, so
        // the browser never starts its own scroll; otherwise wait for a clear direction.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && !(detentRef.current === 'full' && atTop && dy > 0)) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (g.axis === 'y') g.dragging = g.fromHeader || detentRef.current !== 'full' || (atTop && dy > 0);
      }
      if (g.axis !== 'y' || !g.dragging) return;
      if (e.cancelable) e.preventDefault();
      const y = constrainDrag(g.yStart + dy, window.innerHeight);
      apply(y);
      g.samples.push({ t: performance.now(), y });
      if (g.samples.length > 12) g.samples.shift();
    };

    const onEnd = () => {
      const g = gestureRef.current;
      gestureRef.current = null;
      if (!g || !g.dragging) return;
      const velocity = releaseVelocity(g.samples);
      const target = chooseDetent(yRef.current, velocity, window.innerHeight, detentRef.current);
      if (target === 'closed') goBack(pushedRef.current);
      animateTo(target, velocity);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [animateTo, apply]);

  // Mouse drag on the header (desktop / testing)
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || viewRef.current) return;
    const y0 = e.clientY;
    const yStart = yRef.current;
    const samples = [{ t: performance.now(), y: yStart }];
    const move = (ev: PointerEvent) => {
      const y = constrainDrag(yStart + ev.clientY - y0, window.innerHeight);
      apply(y);
      samples.push({ t: performance.now(), y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const v = releaseVelocity(samples);
      const target = chooseDetent(yRef.current, v, window.innerHeight, detentRef.current);
      if (target === 'closed') close();
      else animateTo(target, v);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onPagerScroll = () => {
    const pager = pagerRef.current;
    if (!pager) return;
    const idx = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
    setActive((prev) => (prev === idx ? prev : idx));
  };

  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  const activePage = pages[active] ?? pages[0];
  const viewPage = view ? pages[view.pageIndex] : null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={activePage?.data.title}
        className="result-sheet absolute inset-x-0 top-0 pointer-events-auto bg-[var(--surface)] flex flex-col will-change-transform"
        style={{ height: vh }}
      >
        <div
          data-sheet-header
          onPointerDown={onHeaderPointerDown}
          className="sheet-header shrink-0 px-5 touch-none select-none"
        >
          <div className="flex justify-center pt-2 pb-1" aria-hidden="true">
            <span className="block w-10 h-[5px] rounded-full bg-white/25" />
          </div>
          <div className="flex items-center justify-between gap-3 min-h-[44px]">
            {toast ?? (
              <p className="text-sm text-secondary tabular" aria-live="polite">
                {pages.length > 1 ? tf('sheet.position', language, { n: active + 1, total: pages.length }) : ''}
              </p>
            )}
            <button
              type="button"
              onClick={() => (view ? closeView() : close())}
              aria-label={t('sheet.close', language)}
              className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-secondary hover:text-[var(--text)] bg-[var(--surface-variant)]"
            >
              <CrossIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
        <div
          ref={pagerRef}
          onScroll={onPagerScroll}
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          style={{ overscrollBehaviorX: 'contain', visibility: view ? 'hidden' : 'visible' }}
        >
          {pages.map((page, i) => (
            <div
              key={page.key}
              data-sheet-scroller
              data-page-index={i}
              className="w-full shrink-0 snap-center snap-always h-full no-scrollbar"
              style={{ overscrollBehaviorY: 'contain' }}
              aria-hidden={i !== active}
            >
              {Math.abs(i - active) <= 1 ? (
                <ScanPage
                  page={page}
                  language={language}
                  userContext={userContext}
                  isDeepAnalyzing={isDeepAnalyzing}
                  hasSelfie={hasSelfie}
                  onOpenChat={() => openView('chat', i)}
                  onOpenQuiz={() => openView('quiz', i)}
                  onShare={() => onShare(page)}
                  onGenerateMe={i === 0 ? onGenerateMe : undefined}
                  onScanAnother={() => close()}
                />
              ) : null}
            </div>
          ))}
        </div>

        {view && viewPage && (
          <div className="absolute inset-0 flex flex-col bg-[var(--surface)]">
            {view.kind === 'chat' ? (
              <ChatWithNarration
                key={`${viewPage.key}-${language}`}
                pageKey={viewPage.key}
                artData={viewPage.data}
                language={language}
                userContext={userContext}
                scanId={viewPage.scanId}
                onClose={() => closeView()}
                autoStartVoice
                onPersonaChange={onPersonaChange}
              />
            ) : viewPage.scanId ? (
              <QuizPanel scanId={viewPage.scanId} language={language} onClose={() => closeView()} onPointsChange={onPointsChange} />
            ) : null}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

/** Chat that continues from the narration the visitor just heard (reads the live state itself). */
const ChatWithNarration: React.FC<React.ComponentProps<typeof ChatWindow> & { pageKey: string }> = ({ pageKey, ...props }) => {
  const state = useNarrationState();
  const script = state && state.sourceKey === pageKey ? state.script : props.artData.narration?.script ?? null;
  return <ChatWindow {...props} narrationScript={script} />;
};
