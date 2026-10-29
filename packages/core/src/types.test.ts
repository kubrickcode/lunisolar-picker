import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { describe, expect, it } from 'vitest';
import { invalidBecause, toWeekday, VALID } from './types';

describe('types', () => {
  describe('invalidBecause', () => {
    it('returns the shared valid object when there is no reason', () => {
      expect(invalidBecause([])).toBe(VALID);
    });

    it('orders and deduplicates reasons by the canonical reason list', () => {
      expect(invalidBecause(['range-too-long', 'before-min', 'range-too-long'])).toEqual({
        isValid: false,
        reasons: ['before-min', 'range-too-long'],
      });
    });
  });

  describe('toWeekday', () => {
    it('accepts 0 through 6', () => {
      expect(toWeekday(6)).toBe(6);
    });

    it.each([-1, 7, 2.5])('rejects %s as a programmer error', (value) => {
      expect(() => toWeekday(value)).toThrow(LunisolarPickerError);
    });
  });
});
