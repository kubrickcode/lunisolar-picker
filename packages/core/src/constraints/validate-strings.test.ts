import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { validateDate, validateRange } from './validate-strings';

describe('string helpers for presets', () => {
  it('validates a date string and reports malformed input', () => {
    expect(validateDate('2026-10-14', { max: '2026-10-13' }).reasons).toEqual(['after-max']);
    expect(validateDate('2026-10-14 ').reasons).toEqual(['invalid-date']);
  });

  it('validates a range in either order', () => {
    expect(validateRange({ start: '2026-10-17', end: '2026-10-13' }, { maxDays: 3 }).reasons).toEqual([
      'range-too-long',
    ]);
  });

  it('validates a lunar-entered range against the lunar calendar range', () => {
    expect(
      validateRange({ start: '2026-10-13[u-ca=dangi]', end: '2026-10-15[u-ca=dangi]' }, {}, { calendars: [dangi] })
        .isValid,
    ).toBe(true);
  });

  it('reports a range whose ends are written in different calendars as an invalid date', () => {
    expect(
      validateRange({ start: '2026-10-13', end: '2026-10-15[u-ca=dangi]' }, {}, { calendars: [dangi] }).reasons,
    ).toContain('invalid-date');
  });

  it('reports an unreadable max on a date without applying it', () => {
    const result = validateDate('2026-10-14', { max: 'garbage' });

    expect(result.isValid).toBe(true);
    expect(result.ignoredInputs).toEqual([{ field: 'max', input: 'garbage', reason: 'invalid-date' }]);
  });

  it('reports an unreadable max on a range without applying it', () => {
    const result = validateRange({ start: '2026-10-13', end: '2026-10-14' }, { max: 'garbage' });

    expect(result.isValid).toBe(true);
    expect(result.ignoredInputs).toEqual([{ field: 'max', input: 'garbage', reason: 'invalid-date' }]);
  });

  it('accepts an open end only when open ranges are allowed', () => {
    const range = { start: '2026-10-13', end: null };

    expect(validateRange(range, { isOpenEndAllowed: true }).isValid).toBe(true);
    expect(validateRange(range).reasons).toEqual(['incomplete']);
  });
});
