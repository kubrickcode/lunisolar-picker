import { describe, expect, it } from 'vitest';
import { LunisolarPickerError } from './errors';
import { isMonthCode, parseMonthCode, toMonthCode } from './month-code';

describe('month-code', () => {
  describe('toMonthCode', () => {
    it.each([
      [1, false, 'M01'],
      [4, true, 'M04L'],
      [12, false, 'M12'],
    ])('formats month %i (leap: %s) as %s', (month, isLeapMonth, expected) => {
      expect(toMonthCode(month, isLeapMonth)).toBe(expected);
    });

    it.each([0, 13, 1.5, Number.NaN])('rejects month %s as a programmer error', (month) => {
      expect(() => toMonthCode(month, false)).toThrow(LunisolarPickerError);
    });
  });

  describe('isMonthCode', () => {
    it.each(['M01', 'M12', 'M05L'])('accepts %s', (value) => {
      expect(isMonthCode(value)).toBe(true);
    });

    it.each(['M00', 'M13', 'M1', 'm01', 'M01l', 'M01LL', ' M01'])('rejects %s', (value) => {
      expect(isMonthCode(value)).toBe(false);
    });
  });

  it('parses a leap month code back into its parts', () => {
    expect(parseMonthCode('M06L')).toEqual({ month: 6, isLeapMonth: true });
  });
});
