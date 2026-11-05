import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useNarration, UseNarrationReturn } from './useNarration';

/**
 * Narration state changes many times per second while the guide speaks (captions, status).
 * The engine lives here, above <App>, so those updates re-render only the components that read
 * the state (the narration panel), never the whole app or the result sheet being dragged.
 */
type NarrationActions = Pick<UseNarrationReturn,
  'generate' | 'stop' | 'pause' | 'resume' | 'replay' | 'playSaved' | 'setMode' | 'backgrounded'> & {
  /** Current playing state, read on demand (does not subscribe). */
  isPlaying: () => boolean;
};

const StateContext = createContext<UseNarrationReturn | null>(null);
const ActionsContext = createContext<NarrationActions | null>(null);

export const NarrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const engine = useNarration();
  const ref = useRef(engine);
  ref.current = engine;
  const actions = useMemo<NarrationActions>(() => ({
    generate: (...a) => ref.current.generate(...a),
    stop: () => ref.current.stop(),
    pause: () => ref.current.pause(),
    resume: () => ref.current.resume(),
    replay: (...a) => ref.current.replay(...a),
    playSaved: (...a) => ref.current.playSaved(...a),
    setMode: (...a) => ref.current.setMode(...a),
    backgrounded: () => ref.current.backgrounded(),
    isPlaying: () => ref.current.isPlaying,
  }), []);
  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={engine}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
};

const noop = () => {};
const NOOP_ACTIONS: NarrationActions = {
  generate: async () => null, stop: noop, pause: noop, resume: noop, replay: noop, playSaved: noop,
  setMode: noop, backgrounded: noop, isPlaying: () => false,
};

/** Stable narration controls (never re-render the caller). */
export function useNarrationActions(): NarrationActions {
  return useContext(ActionsContext) ?? NOOP_ACTIONS;
}

/** Live narration state (re-renders the caller on every caption change). */
export function useNarrationState(): UseNarrationReturn | null {
  return useContext(StateContext);
}
