import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { brandEpochDay, epochDayFromCivil } from '../epoch-day';
import { LunisolarPickerError } from '../errors';
import { decodeDangiYear, encodeDangiYear } from './table-codec';
import type { DangiYearRecord } from './year-record';

const leapYear: DangiYearRecord = {
  year: 2025,
  newYearEpochDay: epochDayFromCivil(2025, 1, 29),
  leapMonth: 6,
  monthLengths: [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30],
};

describe('table-codec', () => {
  it('round-trips a year with a leap month', () => {
    expect(decodeDangiYear(leapYear.year, encodeDangiYear(leapYear))).toEqual(leapYear);
  });

  it('round-trips a truncated final year', () => {
    const truncated = { ...leapYear, leapMonth: 0, monthLengths: [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30] };
    expect(decodeDangiYear(truncated.year, encodeDangiYear(truncated))).toEqual(truncated);
  });

  it('fits every encodable year into a positive 31-bit integer and decodes it back', () => {
    const recordArbitrary = fc
      .record({
        year: fc.integer({ min: 1900, max: 2050 }),
        newYearOffset: fc.integer({ min: 0, max: 63 }),
        leapMonth: fc.integer({ min: 0, max: 12 }),
        isLongMonths: fc.array(fc.boolean(), { minLength: 13, maxLength: 13 }),
        knownMonthCount: fc.integer({ min: 1, max: 13 }),
      })
      .map(({ year, newYearOffset, leapMonth, isLongMonths, knownMonthCount }) => {
        const fullCount = leapMonth === 0 ? 12 : 13;
        return {
          year,
          newYearEpochDay: brandEpochDay(epochDayFromCivil(year, 1, 1) + newYearOffset),
          leapMonth,
          monthLengths: isLongMonths.slice(0, Math.min(knownMonthCount, fullCount)).map((isLong) => (isLong ? 30 : 29)),
        };
      });

    fc.assert(
      fc.property(recordArbitrary, (record) => {
        const encoded = encodeDangiYear(record);
        return (
          encoded > 0 &&
          encoded < 2 ** 31 &&
          JSON.stringify(decodeDangiYear(record.year, encoded)) === JSON.stringify(record)
        );
      }),
    );
  });

  it.each([
    ['a new year before January 1', { ...leapYear, newYearEpochDay: brandEpochDay(epochDayFromCivil(2025, 1, 1) - 1) }],
    ['a new year more than 63 days after January 1', { ...leapYear, newYearEpochDay: epochDayFromCivil(2025, 3, 6) }],
    [
      'a non-integer new year offset',
      { ...leapYear, newYearEpochDay: brandEpochDay(epochDayFromCivil(2025, 1, 29) + 0.5) },
    ],
    ['a NaN new year offset', { ...leapYear, newYearEpochDay: brandEpochDay(Number.NaN) }],
    ['a month that is neither 29 nor 30 days', { ...leapYear, monthLengths: [31, ...leapYear.monthLengths.slice(1)] }],
    ['a leap month number above 12', { ...leapYear, leapMonth: 13 }],
    ['more months than the year can hold', { ...leapYear, leapMonth: 0 }],
    ['no months at all', { ...leapYear, monthLengths: [] }],
  ])('refuses to encode %s', (_, record) => {
    expect(() => encodeDangiYear(record)).toThrow(LunisolarPickerError);
  });
});
