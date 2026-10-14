import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  brandEpochDay,
  civilFromEpochDay,
  daysInGregorianMonth,
  epochDayFromCivil,
  isGregorianLeapYear,
  weekdayOf,
} from './epoch-day';
import { LunisolarPickerError } from './errors';

const FIRST_SUPPORTED_EPOCH_DAY = -719_162;
const LAST_SUPPORTED_EPOCH_DAY = 2_932_896;
const MILLISECONDS_PER_DAY = 86_400_000;

describe('epoch-day', () => {
  describe('brandEpochDay', () => {
    it('brands an integer unchanged', () => {
      expect(brandEpochDay(20_740)).toBe(20_740);
    });

    it('throws for a fractional value and names it', () => {
      expect(() => brandEpochDay(20_740.5)).toThrow('20740.5');
      expect(() => brandEpochDay(Number.NaN)).toThrow(LunisolarPickerError);
    });
  });

  describe('epochDayFromCivil', () => {
    it.each([
      [1970, 1, 1, 0],
      [1969, 12, 31, -1],
      [1900, 1, 1, -25_567],
      [2000, 2, 29, 11_016],
      [2000, 3, 1, 11_017],
      [2026, 10, 14, 20_740],
      [1, 1, 1, FIRST_SUPPORTED_EPOCH_DAY],
      [9999, 12, 31, LAST_SUPPORTED_EPOCH_DAY],
    ])('maps %i-%i-%i to epoch day %i', (year, month, day, expected) => {
      expect(epochDayFromCivil(year, month, day)).toBe(expected);
    });

    it('agrees with the platform UTC calendar for every year from 1 to 9999', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9999 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => epochDayFromCivil(year, month, day) === platformEpochDay(year, month, day),
        ),
      );
    });
  });

  describe('civilFromEpochDay', () => {
    it('reads negative epoch days before 1970 as the matching civil date', () => {
      expect(civilFromEpochDay(brandEpochDay(-25_567))).toEqual({ year: 1900, month: 1, day: 1 });
    });

    it('round-trips every epoch day between year 1 and 9999', () => {
      fc.assert(
        fc.property(fc.integer({ min: FIRST_SUPPORTED_EPOCH_DAY, max: LAST_SUPPORTED_EPOCH_DAY }), (value) => {
          const { year, month, day } = civilFromEpochDay(brandEpochDay(value));
          return epochDayFromCivil(year, month, day) === value;
        }),
      );
    });
  });

  describe('weekdayOf', () => {
    it.each([
      [0, 4],
      [-1, 3],
      [-25_567, 1],
      [20_740, 3],
      [LAST_SUPPORTED_EPOCH_DAY, 5],
    ])('returns weekday %i → %i with Sunday as 0', (epochDay, expected) => {
      expect(weekdayOf(brandEpochDay(epochDay))).toBe(expected);
    });
  });

  describe('Gregorian leap rules', () => {
    it.each([
      [1900, false],
      [2000, true],
      [2024, true],
      [2026, false],
    ])('treats %i as leap year: %s', (year, expected) => {
      expect(isGregorianLeapYear(year)).toBe(expected);
    });

    it.each([
      [1900, 2, 28],
      [2000, 2, 29],
      [2026, 4, 30],
      [2026, 12, 31],
    ])('gives %i-%i %i days', (year, month, expected) => {
      expect(daysInGregorianMonth(year, month)).toBe(expected);
    });
  });
});

const platformEpochDay = (year: number, month: number, day: number): number => {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.round(date.getTime() / MILLISECONDS_PER_DAY);
};
