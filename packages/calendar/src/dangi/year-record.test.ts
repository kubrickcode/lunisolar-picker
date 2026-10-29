import { describe, expect, it } from 'vitest';
import { epochDayFromCivil } from '../epoch-day';
import { expectedMonthCount, isTruncated, monthCodesOf } from './year-record';

const regularYear = {
  year: 2026,
  newYearEpochDay: epochDayFromCivil(2026, 2, 17),
  leapMonth: 0,
  monthLengths: [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29],
};

describe('year-record', () => {
  it('orders month codes with the leap month right after its regular month', () => {
    const record = { ...regularYear, leapMonth: 6, monthLengths: [...regularYear.monthLengths, 30] };

    expect(monthCodesOf(record)).toEqual([
      'M01',
      'M02',
      'M03',
      'M04',
      'M05',
      'M06',
      'M06L',
      'M07',
      'M08',
      'M09',
      'M10',
      'M11',
      'M12',
    ]);
    expect(expectedMonthCount(record)).toBe(13);
  });

  it('lists only the known months of a truncated final year', () => {
    const record = { ...regularYear, monthLengths: [30, 29, 30] };

    expect(monthCodesOf(record)).toEqual(['M01', 'M02', 'M03']);
    expect(isTruncated(record)).toBe(true);
    expect(isTruncated(regularYear)).toBe(false);
  });
});
