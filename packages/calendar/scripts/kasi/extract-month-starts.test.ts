import { describe, expect, it } from 'vitest';
import { extractMonthStarts } from './extract-month-starts';
import type { KasiDayItem } from './kasi-types';

const dayItem = (
  solarDay: number,
  lunarMonth: number,
  lunarDay: number,
  lunarMonthDays: number,
  isLeapMonth = false,
): KasiDayItem => ({
  solarDate: { year: 2025, month: 7, day: solarDay },
  lunarYear: 2025,
  lunarMonth,
  lunarDay,
  isLeapMonth,
  lunarMonthDays,
});

describe('extractMonthStarts', () => {
  it('keeps only first days of lunar months in solar order', () => {
    const items = [dayItem(26, 6, 2, 29, true), dayItem(25, 6, 1, 29, true), dayItem(24, 6, 30, 30)];

    expect(extractMonthStarts(items)).toEqual([
      { lunarYear: 2025, lunarMonth: 6, isLeapMonth: true, days: 29, solarStart: '2025-07-25' },
    ]);
  });

  it('accepts consecutive months whose starts are exactly one month length apart', () => {
    const items = [dayItem(1, 5, 1, 29), dayItem(30, 6, 1, 30)];

    expect(extractMonthStarts(items).map((start) => start.solarStart)).toEqual(['2025-07-01', '2025-07-30']);
  });

  it('fails when a month start is missing between two known starts', () => {
    const items = [dayItem(1, 5, 1, 29), dayItem(31, 6, 1, 30)];

    expect(() => extractMonthStarts(items)).toThrow(/does not follow/);
  });

  it('fails when a lunar month length is neither 29 nor 30', () => {
    expect(() => extractMonthStarts([dayItem(1, 5, 1, 31)])).toThrow(/29 or 30/);
  });
});
