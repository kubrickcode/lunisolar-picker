import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { brandEpochDay, epochDayFromCivil } from '../epoch-day';
import { LunisolarPickerError } from '../errors';
import { gregory } from '../gregorian';
import { createStubCalendar } from '../testing/stub-calendar';
import { unwrapOk } from '../testing/unwrap-result';
import { addDays, calendarIdOf, epochDayOf, formatDate, isSameDay, parseDate } from './date-string';

const OCTOBER_14_2026 = epochDayFromCivil(2026, 10, 14);
const stubDangi = createStubCalendar({
  id: 'dangi',
  supportedRange: { min: epochDayFromCivil(1900, 1, 31), max: epochDayFromCivil(2050, 12, 31) },
  fields: { year: 2026, monthCode: 'M09', day: 4 },
});

describe('date-string', () => {
  describe('parseDate', () => {
    it('reads a canonical Gregorian date into its fields', () => {
      expect(unwrapOk(parseDate('2026-10-14'))).toEqual({
        calendar: 'gregory',
        epochDay: OCTOBER_14_2026,
        value: '2026-10-14',
        year: 2026,
        monthCode: 'M10',
        day: 14,
      });
    });

    it('takes fields from the annotated calendar while keeping the solar day', () => {
      const parsed = unwrapOk(parseDate('2026-10-14[u-ca=dangi]', { calendars: [stubDangi] }));

      expect(parsed).toMatchObject({
        calendar: 'dangi',
        epochDay: OCTOBER_14_2026,
        year: 2026,
        monthCode: 'M09',
        day: 4,
      });
    });

    it('rejects a lunar annotation when that calendar was not provided', () => {
      expect(parseDate('2026-10-14[u-ca=dangi]')).toEqual({ isOk: false, error: 'invalid-date' });
    });

    it('passes through the annotated calendar range error', () => {
      expect(parseDate('1899-06-01[u-ca=dangi]', { calendars: [stubDangi] })).toEqual({
        isOk: false,
        error: 'outside-calendar-range',
      });
    });

    it.each([
      '2026-1-5',
      '2026-10-14 ',
      ' 2026-10-14',
      '2026/10/14',
      '20261014',
      '+002026-10-14',
      '0000-01-01',
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-10-14[u-ca=gregory]',
      '2026-10-14[U-CA=DANGI]',
      '2026-10-14[u-ca=dangi][x]',
      '2026-10-14T00:00',
      '',
    ])('rejects the non-canonical input "%s"', (input) => {
      expect(parseDate(input, { calendars: [stubDangi] })).toEqual({ isOk: false, error: 'invalid-date' });
    });
  });

  describe('formatDate', () => {
    it('pads years below 1000 to four digits', () => {
      expect(unwrapOk(formatDate(epochDayFromCivil(999, 3, 7)))).toBe('0999-03-07');
    });

    it('adds the calendar annotation for a non-Gregorian calendar', () => {
      expect(unwrapOk(formatDate(OCTOBER_14_2026, stubDangi))).toBe('2026-10-14[u-ca=dangi]');
    });

    it('reports outside-calendar-range for a day the calendar does not cover', () => {
      expect(formatDate(epochDayFromCivil(1800, 1, 1), stubDangi)).toEqual({
        isOk: false,
        error: 'outside-calendar-range',
      });
    });

    it('round-trips every Gregorian day through parseDate', () => {
      fc.assert(
        fc.property(fc.integer({ min: gregory.supportedRange.min, max: gregory.supportedRange.max }), (value) => {
          const formatted = unwrapOk(formatDate(brandEpochDay(value)));
          const parsed = parseDate(formatted);
          return parsed.isOk && parsed.value.epochDay === value && parsed.value.value === formatted;
        }),
      );
    });
  });

  describe('accessors', () => {
    const lunarEntry = unwrapOk(formatDate(OCTOBER_14_2026, stubDangi));
    const solarEntry = unwrapOk(formatDate(OCTOBER_14_2026));

    it('reads the epoch day and calendar of a branded value', () => {
      expect(epochDayOf(lunarEntry)).toBe(OCTOBER_14_2026);
      expect(calendarIdOf(lunarEntry)).toBe('dangi');
      expect(calendarIdOf(solarEntry)).toBe('gregory');
    });

    it('treats the same solar day entered in different calendars as the same day', () => {
      expect(isSameDay(lunarEntry, solarEntry)).toBe(true);
      expect(lunarEntry === solarEntry).toBe(false);
    });

    it('treats different days as different', () => {
      const nextDay = unwrapOk(formatDate(brandEpochDay(OCTOBER_14_2026 + 1)));
      expect(isSameDay(solarEntry, nextDay)).toBe(false);
    });
  });

  describe('addDays', () => {
    const solarEntry = unwrapOk(parseDate('2026-10-14'));

    it('moves across month and year boundaries in both directions', () => {
      expect(unwrapOk(addDays(solarEntry.value, 79))).toBe('2027-01-01');
      expect(unwrapOk(addDays(solarEntry.value, -14))).toBe('2026-09-30');
      expect(unwrapOk(addDays(solarEntry.value, 0))).toBe('2026-10-14');
    });

    it('keeps the calendar annotation of the input', () => {
      const lunarEntry = unwrapOk(formatDate(OCTOBER_14_2026, stubDangi));

      expect(unwrapOk(addDays(lunarEntry, -6, { calendars: [stubDangi] }))).toBe('2026-10-08[u-ca=dangi]');
    });

    it('rejects an annotated value whose calendar was not provided', () => {
      const lunarEntry = unwrapOk(formatDate(OCTOBER_14_2026, stubDangi));

      expect(addDays(lunarEntry, 1)).toEqual({ isOk: false, error: 'invalid-date' });
    });

    it('reports outside-calendar-range when the result leaves the calendar', () => {
      const lastDay = unwrapOk(formatDate(gregory.supportedRange.max));

      expect(addDays(lastDay, 1)).toEqual({ isOk: false, error: 'outside-calendar-range' });
    });

    it('throws for a fractional amount because that is a programmer error', () => {
      expect(() => addDays(solarEntry.value, 1.5)).toThrow(LunisolarPickerError);
    });
  });
});
