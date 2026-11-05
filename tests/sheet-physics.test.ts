import { describe, it, expect } from 'vitest';
import {
  project, rubberBand, detentOffsets, chooseDetent, constrainDrag, springStep, springSettled, releaseVelocity,
  DECELERATION_RATE, SPRING,
} from '../components/sheet/sheetPhysics';

const VH = 800; // medium detent at y = 400

describe('sheet physics (Apple WWDC18 + Android BottomSheetBehavior constants)', () => {
  it('projects flicks with the UIScrollView deceleration rate', () => {
    expect(DECELERATION_RATE).toBe(0.998);
    expect(project(1000)).toBeCloseTo(499, 0); // (1000/1000) * 0.998 / 0.002
    expect(project(-1000)).toBeCloseTo(-499, 0);
    expect(project(0)).toBe(0);
  });

  it('rubber-bands past the top: grows with overflow but never exceeds the dimension', () => {
    expect(rubberBand(0, VH)).toBe(0);
    const a = rubberBand(100, VH);
    const b = rubberBand(400, VH);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(400);
    expect(rubberBand(1e6, VH)).toBeLessThan(VH);
    expect(constrainDrag(-100, VH)).toBeCloseTo(-a, 6);
    expect(constrainDrag(250, VH)).toBe(250);
  });

  it('uses a half-height medium detent', () => {
    expect(detentOffsets(VH)).toEqual({ full: 0, medium: 400, closed: 800 });
  });

  it('settles slow drags on the nearest detent', () => {
    expect(chooseDetent(380, 0, VH, 'medium')).toBe('medium');
    expect(chooseDetent(120, 0, VH, 'medium')).toBe('full');
    expect(chooseDetent(560, 0, VH, 'medium')).toBe('medium');
  });

  it('dismisses when the projected drop passes half of the medium sheet', () => {
    expect(chooseDetent(620, 0, VH, 'medium')).toBe('closed');
    expect(chooseDetent(450, 340, VH, 'medium')).toBe('closed'); // 450 + ~170 projected > 400 + 200
    expect(chooseDetent(450, 200, VH, 'medium')).toBe('medium'); // 450 + ~100 stays
  });

  it('moves one detent on significant flicks', () => {
    expect(chooseDetent(400, -900, VH, 'medium')).toBe('full');
    expect(chooseDetent(30, 900, VH, 'full')).toBe('medium');
    expect(chooseDetent(420, 900, VH, 'medium')).toBe('closed');
  });

  it('springs are critically damped (no overshoot) and settle in about half a second', () => {
    expect(SPRING.dampingRatio).toBe(1);
    let s = { x: 800, v: 0 };
    let t = 0;
    let minX = Infinity;
    while (!springSettled(s, 400) && t < 3) {
      s = springStep(s, 400, 1 / 60);
      minX = Math.min(minX, s.x);
      t += 1 / 60;
    }
    expect(minX).toBeGreaterThanOrEqual(399.5);
    expect(t).toBeLessThan(0.8);
  });

  it('hands the release velocity to the spring', () => {
    const still = springStep({ x: 400, v: 0 }, 400, 1 / 60);
    const flung = springStep({ x: 400, v: -2000 }, 400, 1 / 60);
    expect(still.x).toBeCloseTo(400, 6);
    expect(flung.x).toBeLessThan(400);
  });

  it('measures release velocity over the last ~80 ms', () => {
    const samples = [
      { t: 0, y: 0 }, { t: 100, y: 0 }, { t: 150, y: 50 }, { t: 200, y: 100 },
    ];
    expect(releaseVelocity(samples)).toBeCloseTo(1000, 0);
    expect(releaseVelocity([{ t: 0, y: 0 }])).toBe(0);
  });
});
