import { epochDayFromCivil, gregory, LunisolarPickerError } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from '../constraints/resolve-constraints';
import {
  boundsFor,
  clampEpochDay,
  constrainDateFields,
  epochDayOfFields,
  fieldsOf,
  supportedYearRange,
} from './calendar-math';

describe('calendar-math', () => {
  it('intersects the constraints with the calendar range', () => {
    const constraints = resolveConstraints({ min: '1800-01-01', max: '2026-10-14' });

    expect(boundsFor(dangi, constraints)).toEqual({
      min: dangi.supportedRange.min,
      max: epochDayFromCivil(2026, 10, 14),
    });
  });

  it('clamps a day into the bounds', () => {
    const bounds = { min: epochDayFromCivil(2026, 10, 1), max: epochDayFromCivil(2026, 10, 31) };

    expect(clampEpochDay(epochDayFromCivil(2026, 9, 1), bounds)).toBe(bounds.min);
    expect(clampEpochDay(epochDayFromCivil(2026, 12, 1), bounds)).toBe(bounds.max);
  });

  it('throws for fields or days the caller should have constrained first', () => {
    expect(() => fieldsOf(dangi, epochDayFromCivil(1899, 1, 1))).toThrow(LunisolarPickerError);
    expect(() => epochDayOfFields(gregory, { year: 2026, monthCode: 'M02', day: 30 })).toThrow(LunisolarPickerError);
  });

  it('reads the first and last supported years of a calendar', () => {
    expect(supportedYearRange(gregory)).toEqual({ firstYear: 1, lastYear: 9999 });
    expect(supportedYearRange(dangi).firstYear).toBe(1900);
  });

  describe('constrainDateFields', () => {
    it('turns a leap month into the regular month of the same number when the year has no such leap month', () => {
      expect(constrainDateFields(dangi, { year: 2026, monthCode: 'M06L', day: 1 })).toEqual({
        year: 2026,
        monthCode: 'M06',
        day: 1,
      });
    });

    it('shortens day 31 to the last day of a 30-day month', () => {
      expect(constrainDateFields(gregory, { year: 2026, monthCode: 'M04', day: 31 })).toEqual({
        year: 2026,
        monthCode: 'M04',
        day: 30,
      });
    });

    it('keeps the year inside the supported years', () => {
      expect(constrainDateFields(dangi, { year: 1850, monthCode: 'M01', day: 1 }).year).toBe(1900);
    });

    it('moves a month missing from the truncated final year to the last known month', () => {
      const { lastYear } = supportedYearRange(dangi);
      const knownMonths = dangi.monthsInYear(lastYear);
      const lastKnownMonth = knownMonths.at(-1);

      const constrained = constrainDateFields(dangi, { year: lastYear, monthCode: 'M12', day: 1 });

      expect(knownMonths).toContain(constrained.monthCode);
      if (!knownMonths.includes('M12')) expect(constrained.monthCode).toBe(lastKnownMonth);
    });

    it('always produces a date the calendar accepts', () => {
      const fields = fieldsOf(dangi, dangi.supportedRange.max);

      expect(dangi.toEpochDay(constrainDateFields(dangi, { ...fields, day: 30 })).isOk).toBe(true);
    });
  });
});
