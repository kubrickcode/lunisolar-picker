import { describe, expect, it } from 'vitest';
import { unwrapOk } from '../testing/unwrap-result';
import { formatMonth, parseMonth } from './month-string';

describe('month-string', () => {
  it('reads a canonical month', () => {
    expect(unwrapOk(parseMonth('2026-10'))).toEqual({ year: 2026, month: 10, value: '2026-10' });
  });

  it.each(['2026-1', '0000-01', '2026-13', '2026-00', '2026-10-01', ' 2026-10', ''])('rejects "%s"', (input) => {
    expect(parseMonth(input)).toEqual({ isOk: false, error: 'invalid-date' });
  });

  it('formats with padding and rejects out-of-range parts', () => {
    expect(unwrapOk(formatMonth(987, 3))).toBe('0987-03');
    expect(formatMonth(2026, 13)).toEqual({ isOk: false, error: 'invalid-date' });
    expect(formatMonth(10_000, 1)).toEqual({ isOk: false, error: 'invalid-date' });
  });
});
