import { epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { supportedYearRange } from './calendar-math';
import {
  compareVisibleMonths,
  listMonthsOfYear,
  listYearPage,
  shiftVisibleMonth,
  visibleMonthOf,
  yearPageStartOf,
} from './visible-month';

describe('visible-month', () => {
  it('rolls Gregorian months across the year boundary', () => {
    expect(shiftVisibleMonth(gregory, { year: 2026, monthCode: 'M12' }, 1)).toEqual({ year: 2027, monthCode: 'M01' });
    expect(shiftVisibleMonth(gregory, { year: 2026, monthCode: 'M01' }, -13)).toEqual({ year: 2024, monthCode: 'M12' });
  });

  it('steps through a lunar leap month', () => {
    expect(shiftVisibleMonth(dangi, { year: 2025, monthCode: 'M06' }, 1)).toEqual({ year: 2025, monthCode: 'M06L' });
    expect(shiftVisibleMonth(dangi, { year: 2025, monthCode: 'M06L' }, 1)).toEqual({ year: 2025, monthCode: 'M07' });
  });

  it('stops at the first and last supported month', () => {
    expect(shiftVisibleMonth(dangi, { year: 1900, monthCode: 'M01' }, -5)).toEqual({ year: 1900, monthCode: 'M01' });
    const lastMonth = visibleMonthOf(dangi, dangi.supportedRange.max);
    expect(shiftVisibleMonth(dangi, lastMonth, 3)).toEqual(lastMonth);
  });

  it('reads the visible month of a day, clamping days outside the calendar', () => {
    expect(visibleMonthOf(dangi, epochDayFromCivil(2026, 10, 14))).toEqual({ year: 2026, monthCode: 'M09' });
    expect(visibleMonthOf(dangi, epochDayFromCivil(1800, 1, 1))).toEqual({ year: 1900, monthCode: 'M01' });
  });

  it('orders months by their first day', () => {
    expect(
      compareVisibleMonths(dangi, { year: 2025, monthCode: 'M06L' }, { year: 2025, monthCode: 'M07' }),
    ).toBeLessThan(0);
  });

  it('lists thirteen months for a lunar leap year', () => {
    expect(listMonthsOfYear(dangi, 2025)).toHaveLength(13);
  });

  it('aligns year pages and drops years outside the calendar', () => {
    expect(yearPageStartOf(2026, 12)).toBe(2016);
    expect(listYearPage(dangi, yearPageStartOf(1900, 12), 12)).toEqual([
      1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907,
    ]);
    expect(supportedYearRange(dangi).firstYear).toBe(1900);
  });
});
