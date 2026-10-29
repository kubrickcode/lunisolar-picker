import { describe, expect, it } from 'vitest';
import { epochDayFromCivil } from '../epoch-day';
import { createStubCalendar } from '../testing/stub-calendar';
import { unwrapOk } from '../testing/unwrap-result';
import { isSameRange, normalizeDateRange } from './date-range';
import { formatDate, parseDate } from './date-string';

const october13 = unwrapOk(parseDate('2026-10-13')).value;
const october17 = unwrapOk(parseDate('2026-10-17')).value;
const stubDangi = createStubCalendar({
  id: 'dangi',
  supportedRange: { min: epochDayFromCivil(1900, 1, 31), max: epochDayFromCivil(2050, 12, 31) },
  fields: { year: 2026, monthCode: 'M09', day: 7 },
});

describe('date-range', () => {
  describe('normalizeDateRange', () => {
    it('keeps an ordered range as is', () => {
      expect(unwrapOk(normalizeDateRange(october13, october17))).toEqual({ start: october13, end: october17 });
    });

    it('swaps a reversed range so start never comes after end', () => {
      expect(unwrapOk(normalizeDateRange(october17, october13))).toEqual({ start: october13, end: october17 });
    });

    it('keeps an open end', () => {
      expect(unwrapOk(normalizeDateRange(october13, null))).toEqual({ start: october13, end: null });
    });

    it('rejects endpoints entered in different calendars', () => {
      const lunarEnd = unwrapOk(formatDate(epochDayFromCivil(2026, 10, 17), stubDangi));
      expect(normalizeDateRange(october13, lunarEnd)).toEqual({ isOk: false, error: 'invalid-date' });
    });
  });

  describe('isSameRange', () => {
    const range = { start: october13, end: october17 };

    it('compares ranges by their canonical strings', () => {
      expect(isSameRange(range, { start: october13, end: october17 })).toBe(true);
      expect(isSameRange(range, { start: october13, end: null })).toBe(false);
    });

    it('treats two empty selections as the same and one empty selection as different', () => {
      expect(isSameRange(null, null)).toBe(true);
      expect(isSameRange(range, null)).toBe(false);
    });
  });
});
