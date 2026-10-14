import { describe, expect, it } from 'vitest';
import { brandEpochDay, civilFromEpochDay, epochDayFromCivil } from '../../src/epoch-day';
import { buildYearRecords, lastEpochDayOf } from './build-year-records';
import { isoDateToEpochDay, toIsoDate } from './iso-date';
import type { KasiMonthStart } from './kasi-types';

type MonthSpec = {
  readonly lunarYear: number;
  readonly lunarMonth: number;
  readonly isLeapMonth?: boolean;
  readonly days: number;
};

const REGULAR_MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);
const LEAP_MONTH_DAYS = 29;

const daysBefore = (specs: readonly MonthSpec[], index: number): number =>
  specs.slice(0, index).reduce((sum, spec) => sum + spec.days, 0);

const monthStartsFrom = (firstSolarStart: string, specs: readonly MonthSpec[]): KasiMonthStart[] => {
  const firstEpochDay = isoDateToEpochDay(firstSolarStart);
  return specs.map((spec, index) => ({
    ...spec,
    isLeapMonth: spec.isLeapMonth ?? false,
    solarStart: toIsoDate(civilFromEpochDay(brandEpochDay(firstEpochDay + daysBefore(specs, index)))),
  }));
};

const regularMonthSpec = (lunarYear: number, lunarMonth: number): MonthSpec => ({
  lunarYear,
  lunarMonth,
  days: lunarMonth % 2 === 0 ? 29 : 30,
});

const fullYear = (lunarYear: number, leapMonth = 0): MonthSpec[] =>
  REGULAR_MONTH_NUMBERS.flatMap((lunarMonth) => [
    regularMonthSpec(lunarYear, lunarMonth),
    ...(lunarMonth === leapMonth ? [{ lunarYear, lunarMonth, isLeapMonth: true, days: LEAP_MONTH_DAYS }] : []),
  ]);

describe('buildYearRecords', () => {
  it('drops months before the first supported year and groups the rest by lunar year', () => {
    const monthStarts = monthStartsFrom('1900-01-01', [
      { lunarYear: 1899, lunarMonth: 12, days: 30 },
      ...fullYear(1900, 8),
      ...fullYear(1901),
    ]);

    const records = buildYearRecords(monthStarts, 1900);

    expect(records.map((record) => record.year)).toEqual([1900, 1901]);
    expect(records[0]).toMatchObject({ newYearEpochDay: epochDayFromCivil(1900, 1, 31), leapMonth: 8 });
    expect(records[0]?.monthLengths).toHaveLength(13);
  });

  it('allows only the final year to be truncated', () => {
    const monthStarts = monthStartsFrom('1900-01-31', [...fullYear(1900), ...fullYear(1901).slice(0, 11)]);

    expect(buildYearRecords(monthStarts, 1900).at(-1)?.monthLengths).toHaveLength(11);
  });

  it('fails when a middle year is missing months', () => {
    const monthStarts = monthStartsFrom('1900-01-31', [...fullYear(1900).slice(0, 11), ...fullYear(1901)]);

    expect(() => buildYearRecords(monthStarts, 1900)).toThrow(/1900 has only 11 months/);
  });

  it('fails when a year has two leap months', () => {
    const yearWithLeapMonth = fullYear(1900, 4);
    const secondLeapMonth = { lunarYear: 1900, lunarMonth: 8, isLeapMonth: true, days: LEAP_MONTH_DAYS };
    const year = [...yearWithLeapMonth.slice(0, 9), secondLeapMonth, ...yearWithLeapMonth.slice(9)];

    expect(() => buildYearRecords(monthStartsFrom('1900-01-31', year), 1900)).toThrow(/2 leap months/);
  });

  it('fails when a year does not begin with the first lunar month', () => {
    const monthStarts = monthStartsFrom('1900-03-01', fullYear(1900).slice(1));

    expect(() => buildYearRecords(monthStarts, 1900)).toThrow(/does not start with month 1/);
  });

  it('fails when the first supported year is absent', () => {
    expect(() => buildYearRecords(monthStartsFrom('1901-02-19', fullYear(1901)), 1900)).toThrow(
      /expected lunar year 1900/,
    );
  });

  it('computes the last covered day from the final month length', () => {
    const monthStarts = monthStartsFrom('1900-01-31', fullYear(1900).slice(0, 2));

    expect(lastEpochDayOf(monthStarts)).toBe(epochDayFromCivil(1900, 1, 31) + 30 + 29 - 1);
  });
});
