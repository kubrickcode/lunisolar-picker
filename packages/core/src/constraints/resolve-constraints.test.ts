import { type EpochDay, epochDayFromCivil, gregory, LunisolarPickerError } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it, vi } from 'vitest';
import { resolveConstraints } from './resolve-constraints';

const october = (day: number): EpochDay => epochDayFromCivil(2026, 10, day);

describe('resolveConstraints', () => {
  it('defaults to the full Gregorian range with no limits', () => {
    const resolved = resolveConstraints({});

    expect(resolved).toMatchObject({
      minEpochDay: gregory.supportedRange.min,
      maxEpochDay: gregory.supportedRange.max,
      minDays: null,
      maxDays: null,
      limitMode: 'block',
      isOpenEndAllowed: false,
      ignoredInputs: [],
    });
    expect(resolved.isEpochDayDisabled(october(14))).toBe(false);
  });

  it('narrows the bounds to the display calendar range even when min is earlier', () => {
    const resolved = resolveConstraints({ min: '1800-01-01' }, dangi, [dangi]);

    expect(resolved.minEpochDay).toBe(dangi.supportedRange.min);
    expect(resolved.supportedRange).toEqual(dangi.supportedRange);
  });

  it('reads a lunar-annotated bound when that calendar is known', () => {
    const resolved = resolveConstraints({ max: '2026-10-14[u-ca=dangi]' }, gregory, [gregory, dangi]);

    expect(resolved.maxEpochDay).toBe(october(14));
  });

  it('records an unreadable bound instead of throwing so the binding can warn', () => {
    const resolved = resolveConstraints({ min: '2026/10/01' });

    expect(resolved.minEpochDay).toBe(gregory.supportedRange.min);
    expect(resolved.ignoredInputs).toEqual([{ field: 'min', input: '2026/10/01', reason: 'invalid-date' }]);
  });

  it('passes canonical Gregorian strings to the disabled-date predicate', () => {
    const isDateDisabled = vi.fn((date: string) => date === '2026-10-15');
    const resolved = resolveConstraints({ isDateDisabled });

    expect(resolved.isEpochDayDisabled(october(15))).toBe(true);
    expect(isDateDisabled).toHaveBeenCalledWith('2026-10-15');
  });

  it.each([[{ minDays: 0 }], [{ maxDays: 1.5 }], [{ minDays: 5, maxDays: 3 }]])(
    'rejects impossible day counts %o as a programmer error',
    (constraints) => {
      expect(() => resolveConstraints(constraints)).toThrow(LunisolarPickerError);
    },
  );
});
