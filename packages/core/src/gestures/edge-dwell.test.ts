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
  });
});
