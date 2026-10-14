import { describe, expect, it } from 'vitest';
import { resolvePresentation } from './use-presentation';

describe('resolvePresentation', () => {
  it.each([
    ['auto', true, 'sheet'],
    ['auto', false, 'popover'],
    ['popover', true, 'popover'],
    ['sheet', false, 'sheet'],
  ] as const)('resolves %s on a coarse narrow screen (%s) to %s', (presentation, isCoarseNarrowScreen, expected) => {
    expect(resolvePresentation(presentation, isCoarseNarrowScreen)).toBe(expected);
  });
});
