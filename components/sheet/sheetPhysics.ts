/**
 * Physics for the gesture-driven result sheet.
 *
 * Constants come from the platforms' own primary sources (we cannot record the
 * native apps from here):
 * - Apple, WWDC18 "Designing Fluid Interfaces": momentum projection with the
 *   UIScrollView deceleration rate (0.998), rubber-banding with c = 0.55, and
 *   springs described by response + damping ratio (1.0 = no bounce for UI).
 * - Android Material BottomSheetBehavior: half-expanded detent at 0.5 of the
 *   parent, hide threshold 0.5, "significant" fling velocity 500 dp/s.
 */

export const DECELERATION_RATE = 0.998;
export const RUBBER_BAND_C = 0.55;
export const SPRING = { response: 0.42, dampingRatio: 1 } as const;
/** Medium detent: fraction of the viewport the sheet covers (iOS .medium, Android halfExpandedRatio). */
export const MEDIUM_FRACTION = 0.5;
/** Flings faster than this (CSS px/s ≈ dp/s) move one detent in the fling direction. */
export const SIGNIFICANT_VELOCITY = 500;
/** Fraction of the medium sheet's height the projected drop must exceed to dismiss. */
export const HIDE_THRESHOLD = 0.5;

/** Distance (px) a flick travels while decelerating to rest (Apple's `project`). */
export function project(velocityPxPerSec: number, rate = DECELERATION_RATE): number {
  return (velocityPxPerSec / 1000) * rate / (1 - rate);
}

/** Apple's rubber-band function: how far content moves for `overflow` px of finger travel. */
export function rubberBand(overflow: number, dimension: number, c = RUBBER_BAND_C): number {
  if (overflow <= 0 || dimension <= 0) return 0;
  return (1 - 1 / ((overflow * c) / dimension + 1)) * dimension;
}

export type Detent = 'full' | 'medium' | 'closed';

/** Y offset (px from the top of the viewport) of each detent. */
export function detentOffsets(viewportHeight: number): Record<Detent, number> {
  return {
    full: 0,
    medium: Math.round(viewportHeight * (1 - MEDIUM_FRACTION)),
    closed: viewportHeight,
  };
}

/** Apply rubber-banding when the finger drags the sheet above the full detent. */
export function constrainDrag(rawY: number, viewportHeight: number): number {
  if (rawY < 0) return -rubberBand(-rawY, viewportHeight);
  return rawY;
}

/**
 * Pick the detent to settle on after a release at `y` with `velocity` (px/s,
 * positive = downwards): project where a natural flick would land, then snap to
 * the nearest detent; strong flicks always move at least one detent.
 */
export function chooseDetent(y: number, velocity: number, viewportHeight: number, current: Detent): Detent {
  const d = detentOffsets(viewportHeight);
  const projected = y + project(velocity);
  const mediumHeight = viewportHeight - d.medium;

  if (Math.abs(velocity) >= SIGNIFICANT_VELOCITY) {
    if (velocity > 0) {
      // Downward flick: full → medium, medium → closed (if it would travel far enough)
      if (y < d.medium - mediumHeight * 0.25) return 'medium';
      return projected - d.medium > mediumHeight * HIDE_THRESHOLD ? 'closed' : 'medium';
    }
    return 'full';
  }
  if (projected - d.medium > mediumHeight * HIDE_THRESHOLD) return 'closed';
  const candidates: Detent[] = ['full', 'medium'];
  return candidates.reduce((best, det) =>
    Math.abs(d[det] - projected) < Math.abs(d[best] - projected) ? det : best, current === 'closed' ? 'medium' : current);
}

export interface SpringState {
  x: number;
  v: number;
}

/**
 * Advance a damped spring towards `target` by `dt` seconds (semi-implicit
 * Euler with 1 ms substeps). Stiffness and damping follow Apple's mapping from
 * response/damping ratio: k = (2π / response)², c = 4π·ζ / response (mass 1).
 */
export function springStep(state: SpringState, target: number, dt: number, spring = SPRING): SpringState {
  const k = (2 * Math.PI / spring.response) ** 2;
  const c = (4 * Math.PI * spring.dampingRatio) / spring.response;
  let { x, v } = state;
  const steps = Math.max(1, Math.round(dt / 0.001));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const a = -k * (x - target) - c * v;
    v += a * h;
    x += v * h;
  }
  return { x, v };
}

/** True once the spring is visually at rest. */
export function springSettled(state: SpringState, target: number): boolean {
  return Math.abs(state.x - target) < 0.5 && Math.abs(state.v) < 5;
}

/** Release velocity (px/s) from recent pointer samples, using the last ~80 ms. */
export function releaseVelocity(samples: { t: number; y: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let i = samples.length - 1; i >= 0; i--) {
    if (last.t - samples[i].t > 80) break;
    first = samples[i];
  }
  const dt = (last.t - first.t) / 1000;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}
