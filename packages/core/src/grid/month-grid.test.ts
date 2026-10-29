import { epochDayFromCivil, gregory, parseDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { buildMonthGrid } from './month-grid';

const october2026 = { year: 2026, monthCode: 'M10' } as const;

describe('buildMonthGrid', () => {
  it('always lays out six full weeks starting on the configured weekday', () => {
    const sundayGrid = buildMonthGrid({
      calendar: gregory,
      month: october2026,
      weekStartsOn: 0,
      secondaryCalendar: null,
    });
    const mondayGrid = buildMonthGrid({
      calendar: gregory,
      month: october2026,
      weekStartsOn: 1,
      secondaryCalendar: null,
    });

    expect(sundayGrid.weeks).toHaveLength(6);
    expect(sundayGrid.weeks.every((week) => week.length === 7)).toBe(true);
    expect(sundayGrid.weeks[0]?.[0]?.date).toBe('2026-09-27');
    expect(mondayGrid.weeks[0]?.[0]?.date).toBe('2026-09-28');
  });

  it('marks days of neighbouring months as outside the month', () => {
    const grid = buildMonthGrid({ calendar: gregory, month: october2026, weekStartsOn: 0, secondaryCalendar: null });
    const cells = grid.weeks.flat();

    expect(cells.filter((cell) => !cell.isOutsideMonth)).toHaveLength(31);
    expect(cells[0]).toMatchObject({ isOutsideMonth: true, day: 27, weekday: 0 });
  });

  it('labels each solar day with its lunar date when a secondary calendar is given', () => {
    const grid = buildMonthGrid({ calendar: gregory, month: october2026, weekStartsOn: 0, secondaryCalendar: dangi });
    const october11 = grid.weeks.flat().find((cell) => cell.epochDay === epochDayFromCivil(2026, 10, 11));

    expect(october11?.secondary).toEqual({
      calendarId: 'dangi',
      monthCode: 'M09',
      day: 1,
      isLeapMonth: false,
      isFirstDayOfMonth: true,
    });
  });

  it('builds a lunar leap month grid with lunar day numbers and solar labels', () => {
    const grid = buildMonthGrid({
      calendar: dangi,
      month: { year: 2025, monthCode: 'M06L' },
      weekStartsOn: 0,
      secondaryCalendar: gregory,
    });
    const inMonth = grid.weeks.flat().filter((cell) => !cell.isOutsideMonth);

    expect(inMonth).toHaveLength(dangi.daysInMonth(2025, 'M06L'));
    expect(inMonth[0]).toMatchObject({ day: 1, date: '2025-07-25' });
    expect(inMonth[0]?.secondary).toMatchObject({ calendarId: 'gregory', monthCode: 'M07', day: 25 });
  });

  it('flags leading days before the first lunar month the calendar can show', () => {
    const grid = buildMonthGrid({
      calendar: dangi,
      month: { year: 1900, monthCode: 'M01' },
      weekStartsOn: 0,
      secondaryCalendar: null,
    });
    const leading = grid.weeks.flat().filter((cell) => cell.epochDay < dangi.supportedRange.min);

    expect(leading.length).toBeGreaterThan(0);
    expect(leading.every((cell) => cell.isOutsideSupportedRange && cell.isOutsideMonth)).toBe(true);
  });

  it('flags trailing days past the last supported lunar day without throwing', () => {
    const lastMonth = { year: 2050, monthCode: 'M11' } as const;
    const grid = buildMonthGrid({ calendar: dangi, month: lastMonth, weekStartsOn: 0, secondaryCalendar: gregory });
    const trailing = grid.weeks.flat().filter((cell) => cell.epochDay > dangi.supportedRange.max);

    expect(trailing.length).toBeGreaterThan(0);
    expect(trailing.every((cell) => cell.isOutsideSupportedRange && cell.isOutsideMonth)).toBe(true);
  });

  it('gives trailing days past 9999-12-31 a canonical clamped date string', () => {
    const grid = buildMonthGrid({
      calendar: gregory,
      month: { year: 9999, monthCode: 'M12' },
      weekStartsOn: 0,
      secondaryCalendar: null,
    });
    const trailing = grid.weeks.flat().filter((cell) => cell.epochDay > gregory.supportedRange.max);

    expect(trailing.length).toBeGreaterThan(0);
    expect(trailing.every((cell) => cell.isOutsideSupportedRange && cell.date === '9999-12-31')).toBe(true);
    expect(grid.weeks.flat().every((cell) => parseDate(cell.date).isOk)).toBe(true);
  });

  it('lays out a lunar grid starting on Monday', () => {
    const grid = buildMonthGrid({
      calendar: dangi,
      month: { year: 2026, monthCode: 'M09' },
      weekStartsOn: 1,
      secondaryCalendar: null,
    });
    const firstCell = grid.weeks[0]?.[0];

    expect(firstCell?.weekday).toBe(1);
    expect(grid.weeks.flat().filter((cell) => !cell.isOutsideMonth)).toHaveLength(dangi.daysInMonth(2026, 'M09'));
  });

  it('marks the first day of a lunar leap month on a Gregorian grid', () => {
    const grid = buildMonthGrid({
      calendar: gregory,
      month: { year: 2025, monthCode: 'M07' },
      weekStartsOn: 0,
      secondaryCalendar: dangi,
    });
    const july25 = grid.weeks.flat().find((cell) => cell.epochDay === epochDayFromCivil(2025, 7, 25));

    expect(july25?.secondary).toEqual({
      calendarId: 'dangi',
      monthCode: 'M06L',
      day: 1,
      isLeapMonth: true,
      isFirstDayOfMonth: true,
    });
  });
});
