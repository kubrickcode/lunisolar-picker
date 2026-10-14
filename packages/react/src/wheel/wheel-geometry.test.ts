import { describe, expect, it } from 'vitest';
import { clampPosition, nearestEnabledIndex, normalizeWheelDelta, renderWindowAround } from './wheel-geometry';

const option = (value: number, isDisabled = false) => ({ value, label: String(value), isDisabled });

describe('wheel-geometry', () => {
  it.each([
    [120, 0, 600, 120],
    [3, 1, 600, 48],
    [1, 2, 600, 600],
  ])('normalizes delta %i in mode %i to %i pixels', (deltaY, deltaMode, pageHeight, expected) => {
    expect(normalizeWheelDelta(deltaY, deltaMode, pageHeight)).toBe(expected);
  });

  it('keeps the position between the first and last item', () => {
    expect(clampPosition(-2, 10)).toBe(0);
    expect(clampPosition(12, 10)).toBe(9);
    expect(clampPosition(4.5, 10)).toBe(4.5);
  });

  it('skips disabled options toward the closest enabled one', () => {
    const options = [option(1), option(2, true), option(3, true), option(4)];

    expect(nearestEnabledIndex(options, 1)).toBe(0);
    expect(nearestEnabledIndex(options, 2)).toBe(3);
  });

  it('renders only a window of items around the center', () => {
    expect(renderWindowAround(5000, 9999, 20)).toEqual({ start: 4980, end: 5020 });
    expect(renderWindowAround(3, 9999, 20)).toEqual({ start: 0, end: 23 });
  });
});
