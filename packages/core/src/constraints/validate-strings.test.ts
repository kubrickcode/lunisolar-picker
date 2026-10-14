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
});
