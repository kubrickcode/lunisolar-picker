import { describe, expect, it } from 'vitest';
import { brandEpochDay, epochDayFromCivil } from '../epoch-day';
import { LunisolarPickerError } from '../errors';
import { createDangiCalendar } from './dangi-calendar';
import { encodeDangiYear } from './table-codec';
import type { DangiYearRecord } from './year-record';

const alternatingLengths = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => (index % 2 === 0 ? 30 : 29));

const sumOf = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const year2000: DangiYearRecord = {
  year: 2000,
  newYearEpochDay: epochDayFromCivil(2000, 2, 5),
  leapMonth: 0,
  monthLengths: alternatingLengths(12),
};
const year2001: DangiYearRecord = {
  year: 2001,
  newYearEpochDay: brandEpochDay(year2000.newYearEpochDay + sumOf(year2000.monthLengths)),
  leapMonth: 4,
  monthLengths: alternatingLengths(13),
};
const year2002: DangiYearRecord = {
  year: 2002,
  newYearEpochDay: brandEpochDay(year2001.newYearEpochDay + sumOf(year2001.monthLengths)),
  leapMonth: 0,
  monthLengths: alternatingLengths(3),
};
const lastEpochDay = brandEpochDay(year2002.newYearEpochDay + sumOf(year2002.monthLengths) - 1);
const calendar = createDangiCalendar({
  firstYear: 2000,
  yearTable: [year2000, year2001, year2002].map(encodeDangiYear),
  lastEpochDay,
});

describe('createDangiCalendar', () => {
  it('spans from the first lunar new year to the last known day', () => {
    expect(calendar.supportedRange).toEqual({ min: year2000.newYearEpochDay, max: lastEpochDay });
    expect(calendar.fromEpochDay(calendar.supportedRange.min).isOk).toBe(true);
    expect(calendar.fromEpochDay(calendar.supportedRange.max).isOk).toBe(true);
  });

  it('places the leap month right after its regular month', () => {
    expect(calendar.monthsInYear(2001).slice(3, 6)).toEqual(['M04', 'M04L', 'M05']);
  });

  it('counts days through the leap month when converting to epoch days', () => {
    const leapMonthStart = year2001.newYearEpochDay + sumOf(year2001.monthLengths.slice(0, 4));

    expect(calendar.toEpochDay({ year: 2001, monthCode: 'M04L', day: 1 })).toEqual({
      isOk: true,
      value: leapMonthStart,
    });
    expect(calendar.fromEpochDay(brandEpochDay(leapMonthStart))).toEqual({
      isOk: true,
      value: { year: 2001, monthCode: 'M04L', day: 1 },
    });
  });

  it('maps the day before a lunar new year to the last day of the previous lunar year', () => {
    const dayBefore = brandEpochDay(year2001.newYearEpochDay - 1);

    expect(calendar.fromEpochDay(dayBefore)).toEqual({
      isOk: true,
      value: { year: 2000, monthCode: 'M12', day: 29 },
    });
  });

  it.each([
    [{ year: 2000, monthCode: 'M02' as const, day: 30 }],
    [{ year: 2000, monthCode: 'M04L' as const, day: 1 }],
    [{ year: 2000, monthCode: 'M01' as const, day: 0 }],
    [{ year: 2002, monthCode: 'M01L' as const, day: 1 }],
  ])('reports invalid-date for %o', (fields) => {
    expect(calendar.toEpochDay(fields)).toEqual({ isOk: false, error: 'invalid-date' });
  });

  it.each([
    [{ year: 1999, monthCode: 'M01' as const, day: 1 }],
    [{ year: 2003, monthCode: 'M01' as const, day: 1 }],
    [{ year: 2002, monthCode: 'M04' as const, day: 1 }],
  ])('reports outside-calendar-range for %o, including months past the truncated final year', (fields) => {
    expect(calendar.toEpochDay(fields)).toEqual({ isOk: false, error: 'outside-calendar-range' });
  });

  it('reports outside-calendar-range one day on either side of the supported range', () => {
    expect(calendar.fromEpochDay(brandEpochDay(calendar.supportedRange.min - 1))).toEqual({
      isOk: false,
      error: 'outside-calendar-range',
    });
    expect(calendar.fromEpochDay(brandEpochDay(calendar.supportedRange.max + 1))).toEqual({
      isOk: false,
      error: 'outside-calendar-range',
    });
  });

  it('throws for month lookups the caller should have checked first', () => {
    expect(() => calendar.monthsInYear(2003)).toThrow(LunisolarPickerError);
    expect(() => calendar.daysInMonth(2000, 'M04L')).toThrow(LunisolarPickerError);
  });

  it('refuses an empty table', () => {
    expect(() => createDangiCalendar({ firstYear: 2000, yearTable: [], lastEpochDay })).toThrow(LunisolarPickerError);
  });
});
