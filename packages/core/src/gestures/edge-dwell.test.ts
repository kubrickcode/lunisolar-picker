import { describe, expect, it } from 'vitest';
import { createEdgeDwell, EDGE_DWELL_DELAY_MS } from './edge-dwell';

describe('gestures', () => {
  describe('edge dwell', () => {
    it('reports the edge once the pointer has stayed long enough, then restarts the timer', () => {
      const dwell = createEdgeDwell();
      dwell.enter('next', 1000);

      expect(dwell.poll(1000 + EDGE_DWELL_DELAY_MS - 1)).toBeNull();
      expect(dwell.poll(1000 + EDGE_DWELL_DELAY_MS)).toBe('next');
      expect(dwell.poll(1000 + EDGE_DWELL_DELAY_MS + 1)).toBeNull();
      expect(dwell.poll(1000 + EDGE_DWELL_DELAY_MS * 2)).toBe('next');
    });

    it('keeps the original start when entering the same edge again', () => {
      const dwell = createEdgeDwell(100);
      dwell.enter('previous', 0);
      dwell.enter('previous', 90);

      expect(dwell.poll(100)).toBe('previous');
    });

    it('restarts when the direction changes and stops after leaving', () => {
      const dwell = createEdgeDwell(100);
      dwell.enter('previous', 0);
      dwell.enter('next', 80);
      expect(dwell.poll(150)).toBeNull();
      dwell.leave();
      expect(dwell.poll(1000)).toBeNull();
    });

    it('fires the new direction at its own delay after a direction change', () => {
      const dwell = createEdgeDwell(100);
      dwell.enter('previous', 0);
      dwell.enter('next', 80);

      expect(dwell.poll(179)).toBeNull();
      expect(dwell.poll(180)).toBe('next');
    });

    it('reports nothing before any enter', () => {
      expect(createEdgeDwell(100).poll(1000)).toBeNull();
    });

    it('restarts the timer when re-entering after leaving', () => {
      const dwell = createEdgeDwell(100);
      dwell.enter('next', 0);
      dwell.leave();
      dwell.enter('next', 90);

      expect(dwell.poll(100)).toBeNull();
      expect(dwell.poll(190)).toBe('next');
    });
  });
});
