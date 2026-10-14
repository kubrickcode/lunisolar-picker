import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type EpochDay, epochDayFromCivil } from './epoch-day';
import { LunisolarPickerError } from './errors';
import { gregory } from './gregorian';
import type { MonthCode } from './month-code';

describe('gregory', () => {
  it('spans 0001-01-01 through 9999-12-31', () => {
    expect(gregory.supportedRange).toEqual({ min: epochDayFromCivil(1, 1, 1), max: epochDayFromCivil(9999, 12, 31) });
  });

  describe('monthsInYear', () => {
    it('lists twelve regular months', () => {
      expect(gregory.monthsInYear(2026)).toEqual([
        'M01',
        'M02',
        'M03',
        'M04',
        'M05',
        'M06',
        'M07',
        'M08',
        'M09',
        'M10',
        'M11',
        'M12',
      ]);
    });

    it('throws for a year outside 1-9999', () => {
      expect(() => gregory.monthsInYear(10_000)).toThrow(LunisolarPickerError);
    });
  });

  describe('daysInMonth', () => {
    it('gives February 1900 twenty-eight days', () => {
      expect(gregory.daysInMonth(1900, 'M02')).toBe(28);
    });

    it('throws for a leap month code because the Gregorian calendar has none', () => {
      expect(() => gregory.daysInMonth(2026, 'M02L')).toThrow(LunisolarPickerError);
    });
  });

  describe('toEpochDay', () => {
    it('converts a valid date', () => {
      expect(gregory.toEpochDay({ year: 2026, monthCode: 'M10', day: 14 })).toEqual({ isOk: true, value: 20_740 });
    });

    it.each([
      [{ year: 2026, monthCode: 'M02' as MonthCode, day: 29 }],
      [{ year: 2026, monthCode: 'M02L' as MonthCode, day: 1 }],
      [{ year: 2026, monthCode: 'M13' as MonthCode, day: 1 }],
      [{ year: 2026, monthCode: 'M01' as MonthCode, day: 0 }],
      [{ year: 2026, monthCode: 'M01' as MonthCode, day: 1.5 }],
    ])('reports invalid-date for %o', (fields) => {
      expect(gregory.toEpochDay(fields)).toEqual({ isOk: false, error: 'invalid-date' });
    });

    it.each([0, 10_000, 2026.5])('reports outside-calendar-range for year %s', (year) => {
      expect(gregory.toEpochDay({ year, monthCode: 'M01', day: 1 })).toEqual({
        isOk: false,
        error: 'outside-calendar-range',
      });
    });
  });

  describe('fromEpochDay', () => {
    it('reports outside-calendar-range one day past 9999-12-31', () => {
      const pastLastDay = (gregory.supportedRange.max + 1) as EpochDay;
      expect(gregory.fromEpochDay(pastLastDay)).toEqual({ isOk: false, error: 'outside-calendar-range' });
    });

    it('round-trips every supported epoch day', () => {
      fc.assert(
        fc.property(fc.integer({ min: gregory.supportedRange.min, max: gregory.supportedRange.max }), (value) => {
          const fields = gregory.fromEpochDay(value as EpochDay);
          if (!fields.isOk) return false;
          const back = gregory.toEpochDay(fields.value);
          return back.isOk && back.value === value;
        }),
      );
    });
  });
});
