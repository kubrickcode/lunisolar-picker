import { gregory, LunisolarPickerError } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from '../constraints/resolve-constraints';
import { ko } from '../locales/ko';
import { buildTimeColumns, buildWheelDateColumns } from './wheel-columns';

describe('wheel columns', () => {
  it('lists thirteen lunar months with a localized leap month label', () => {
    const columns = buildWheelDateColumns(dangi, { day: 1, monthCode: 'M06L', year: 2025 }, resolveConstraints({}), ko);

    expect(columns.months).toHaveLength(13);
    expect(columns.months[6]).toEqual({ isDisabled: false, label: '윤6월', value: 'M06L' });
  });

  it('limits years to the constraints and disables days outside them', () => {
    const constraints = resolveConstraints({ max: '2027-03-01', min: '2026-10-10' });

    const columns = buildWheelDateColumns(gregory, { day: 14, monthCode: 'M10', year: 2026 }, constraints, ko);

    expect(columns.years.map((option) => option.value)).toEqual([2026, 2027]);
    expect(columns.days.filter((option) => option.isDisabled).map((option) => option.value)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(columns.months.find((option) => option.value === 'M09')?.isDisabled).toBe(true);
  });

  it('disables days the app marks as unavailable', () => {
    const constraints = resolveConstraints({ isDateDisabled: (date) => date === '2026-10-14' });

    const columns = buildWheelDateColumns(gregory, { day: 1, monthCode: 'M10', year: 2026 }, constraints, ko);

    expect(columns.days[13]).toEqual({ isDisabled: true, label: '14', value: 14 });
  });

  it('builds hour and minute columns from the step and end-of-day option', () => {
    const fiveMinutes = buildTimeColumns({ isEndOfDayAllowed: false, minuteStep: 5 });
    const endOfDay = buildTimeColumns({ isEndOfDayAllowed: true, minuteStep: 1 });

    expect(fiveMinutes.minutes).toHaveLength(12);
    expect(fiveMinutes.minutes[1]).toEqual({ isDisabled: false, label: '05', value: 5 });
    expect(fiveMinutes.hours).toHaveLength(24);
    expect(endOfDay.hours.at(-1)).toEqual({ isDisabled: false, label: '24', value: 24 });
  });

  it('keeps the lunar years inside the calendar range', () => {
    const columns = buildWheelDateColumns(
      dangi,
      { day: 1, monthCode: 'M01', year: 1900 },
      resolveConstraints({ max: '1905-01-01' }),
      ko,
    );

    expect(columns.years[0]?.value).toBe(1900);
    expect(columns.years.at(-1)?.value).toBe(1904);
  });

  it('builds empty years and fully disabled months and days when min lies past the calendar range', () => {
    const columns = buildWheelDateColumns(
      dangi,
      { day: 1, monthCode: 'M01', year: 2050 },
      resolveConstraints({ min: '2052-01-01' }),
      ko,
    );

    expect(columns.years).toEqual([]);
    expect(columns.months.every((option) => option.isDisabled)).toBe(true);
    expect(columns.days.every((option) => option.isDisabled)).toBe(true);
  });

  it('omits the leap month in a non-leap year', () => {
    const columns = buildWheelDateColumns(dangi, { day: 1, monthCode: 'M01', year: 2024 }, resolveConstraints({}), ko);

    expect(columns.months).toHaveLength(12);
    expect(columns.months.some((option) => option.value === 'M06L')).toBe(false);
  });

  it('lists 29 or 30 days depending on the month length', () => {
    const february = buildWheelDateColumns(
      gregory,
      { day: 1, monthCode: 'M02', year: 2025 },
      resolveConstraints({}),
      ko,
    );
    const leapFebruary = buildWheelDateColumns(
      gregory,
      { day: 1, monthCode: 'M02', year: 2024 },
      resolveConstraints({}),
      ko,
    );

    expect(february.days).toHaveLength(28);
    expect(leapFebruary.days).toHaveLength(29);
  });

  it.each([0, 7, 2.5, 61, Number.NaN])('rejects minuteStep %s', (minuteStep) => {
    expect(() => buildTimeColumns({ isEndOfDayAllowed: false, minuteStep })).toThrow(LunisolarPickerError);
  });
});
