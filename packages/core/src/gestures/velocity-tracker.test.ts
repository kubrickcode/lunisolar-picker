import { describe, expect, it } from 'vitest';
import { createVelocityTracker } from './velocity-tracker';

describe('gestures', () => {
  describe('velocity tracker', () => {
    it('measures velocity over recent samples in pixels per millisecond', () => {
      const tracker = createVelocityTracker();
      tracker.add({ position: 0, timeMs: 1000 });
      tracker.add({ position: 50, timeMs: 1050 });
      tracker.add({ position: 100, timeMs: 1100 });

      expect(tracker.velocity()).toBe(1);
    });

    it('drops samples older than the measurement window', () => {
      const tracker = createVelocityTracker();
      tracker.add({ position: 0, timeMs: 0 });
      tracker.add({ position: 500, timeMs: 1000 });
      tracker.add({ position: 520, timeMs: 1040 });

      expect(tracker.velocity()).toBe(0.5);
    });

    it('keeps a sample exactly at the window boundary and drops one just past it', () => {
      const atBoundary = createVelocityTracker();
      atBoundary.add({ position: 0, timeMs: 0 });
      atBoundary.add({ position: 100, timeMs: 100 });
      expect(atBoundary.velocity()).toBe(1);

      const pastBoundary = createVelocityTracker();
      pastBoundary.add({ position: 0, timeMs: 0 });
      pastBoundary.add({ position: 100, timeMs: 101 });
      expect(pastBoundary.velocity()).toBe(0);
    });

    it('ignores a sample older than the newest one', () => {
      const tracker = createVelocityTracker();
      tracker.add({ position: 0, timeMs: 100 });
      tracker.add({ position: 50, timeMs: 150 });
      tracker.add({ position: 999, timeMs: 120 });

      expect(tracker.velocity()).toBe(1);
    });

    it('reports zero without two samples and after reset', () => {
      const tracker = createVelocityTracker();
      tracker.add({ position: 10, timeMs: 0 });
      expect(tracker.velocity()).toBe(0);
      tracker.add({ position: 30, timeMs: 10 });
      tracker.reset();
      expect(tracker.velocity()).toBe(0);
    });
  });
});
