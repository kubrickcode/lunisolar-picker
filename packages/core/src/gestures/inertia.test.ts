import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { easeOutPosition, projectInertia } from './inertia';

describe('gestures', () => {
  describe('projectInertia', () => {
    it('snaps to the nearest item when released without velocity', () => {
      expect(projectInertia({ itemCount: 10, itemSize: 40, offset: 130, velocity: 0 })).toEqual({
        durationMs: 200,
        index: 3,
      });
    });

    it('carries a fast fling several items further', () => {
      expect(projectInertia({ itemCount: 100, itemSize: 40, offset: 0, velocity: 1 })).toEqual({
        durationMs: 500,
        index: 6,
      });
    });

    it('never lands outside the list and keeps durations bounded', () => {
      fc.assert(
        fc.property(
          fc.double({ max: 5000, min: -5000, noNaN: true }),
          fc.double({ max: 20, min: -20, noNaN: true }),
          fc.integer({ max: 500, min: 1 }),
          (offset, velocity, itemCount) => {
            const target = projectInertia({ itemCount, itemSize: 40, offset, velocity });
            return (
              target.index >= 0 && target.index < itemCount && target.durationMs >= 120 && target.durationMs <= 900
            );
          },
        ),
      );
    });
  });

  describe('easeOutPosition', () => {
    it('starts at the origin, ends at the target and never moves backward', () => {
      expect(easeOutPosition(0, 100, 0, 300)).toBe(0);
      expect(easeOutPosition(0, 100, 300, 300)).toBe(100);
      expect(easeOutPosition(0, 100, 900, 300)).toBe(100);
      const samples = [0, 50, 100, 150, 200, 250, 300].map((elapsed) => easeOutPosition(0, 100, elapsed, 300));
      expect(samples).toEqual([...samples].sort((first, second) => first - second));
    });

    it('jumps to the target instead of returning NaN when the duration is not positive', () => {
      expect(easeOutPosition(0, 100, 0, 0)).toBe(100);
      expect(easeOutPosition(0, 100, 50, -10)).toBe(100);
    });

    it('stays at the origin for negative elapsed time', () => {
      expect(easeOutPosition(20, 100, -50, 300)).toBe(20);
    });
  });
});
