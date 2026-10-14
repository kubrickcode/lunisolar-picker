import { epochDayFromCivil, gregory, LunisolarPickerError, VALIDATION_REASONS } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { formatDateForField } from './format-date-for-field';
import { ja } from './ja';
import { ko } from './ko';
import { defineLocale, type LocaleData } from './locale-data';

const LOCALES: readonly LocaleData[] = [ko, en, ja];
const OCTOBER_14_2026 = epochDayFromCivil(2026, 10, 14);

describe('locales', () => {
  describe('defineLocale', () => {
    it('rejects a locale with eleven month names', () => {
      const broken = { ...ko, months: { ...ko.months, long: ko.months.long.slice(0, 11) } };
      expect(() => defineLocale(broken)).toThrow(LunisolarPickerError);
    });

    it('rejects a field order that repeats a segment', () => {
      const broken = { ...ko, field: { ...ko.field, order: ['year', 'year', 'day'] as const } };
      expect(() => defineLocale(broken)).toThrow(/field.order/);
    });

    it('rejects an empty validation message', () => {
      const broken = { ...ko, labels: { ...ko.labels, validation: { ...ko.labels.validation, 'invalid-date': '' } } };
      expect(() => defineLocale(broken)).toThrow(/invalid-date/);
    });
  });

  it.each(LOCALES.map((locale) => [locale.id, locale] as const))(
    '%s provides a message for every validation reason',
    (_, locale) => {
      for (const reason of VALIDATION_REASONS) expect(locale.labels.validation[reason]).not.toBe('');
    },
  );

  describe('ko', () => {
    it('formats headings, month names and day labels for both calendars', () => {
      expect(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory')).toBe('2026년 10월');
      expect(ko.formatHeading({ year: 2025, monthCode: 'M06L' }, 'dangi')).toBe('음력 2025년 윤6월');
      expect(ko.formatMonthName({ year: 2025, monthCode: 'M06L' }, 'dangi')).toBe('윤6월');
      expect(ko.formatDayLabel({ year: 2026, monthCode: 'M10', day: 14 }, 3, 'gregory')).toBe(
        '2026년 10월 14일 수요일',
      );
      expect(ko.formatDayLabel({ year: 2026, monthCode: 'M09', day: 4 }, 3, 'dangi')).toBe(
        '음력 2026년 9월 4일 수요일',
      );
    });

    it('formats a date without weekday or calendar name for secondary labels', () => {
      expect(ko.formatDateLabel({ year: 2025, monthCode: 'M06L', day: 29 }, 'dangi')).toBe('2025년 윤6월 29일');
      expect(en.formatDateLabel({ year: 2025, monthCode: 'M06L', day: 29 }, 'dangi')).toBe('Leap Month 6 Day 29, 2025');
      expect(en.formatDateLabel({ year: 2026, monthCode: 'M10', day: 14 }, 'gregory')).toBe('October 14, 2026');
      expect(ja.formatDateLabel({ year: 2025, monthCode: 'M06L', day: 29 }, 'dangi')).toBe('2025年閏6月29日');
    });

    it('shows the month on the first day of a secondary month and the day number otherwise', () => {
      const firstDay = {
        calendarId: 'dangi',
        monthCode: 'M06L',
        day: 1,
        isLeapMonth: true,
        isFirstDayOfMonth: true,
      } as const;
      expect(ko.formatSecondaryLabel(firstDay)).toBe('윤6.1');
      expect(ko.formatSecondaryLabel({ ...firstDay, day: 14, isFirstDayOfMonth: false })).toBe('14');
    });
  });

  describe('en and ja', () => {
    it('formats English headings and leap months', () => {
      expect(en.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory')).toBe('October 2026');
      expect(en.formatMonthName({ year: 2025, monthCode: 'M06L' }, 'dangi')).toBe('Leap Month 6');
      expect(en.formatDayLabel({ year: 2026, monthCode: 'M10', day: 14 }, 3, 'gregory')).toBe(
        'Wednesday, October 14, 2026',
      );
    });

    it('formats Japanese headings and leap months', () => {
      expect(ja.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory')).toBe('2026年10月');
      expect(ja.formatMonthName({ year: 2025, monthCode: 'M06L' }, 'dangi')).toBe('閏6月');
    });
  });

  describe('formatDateForField', () => {
    it.each([
      [ko, '2026. 10. 14'],
      [en, '10/14/2026'],
      [ja, '2026/10/14'],
    ])('orders segments and separators by locale', (locale, expected) => {
      expect(formatDateForField(OCTOBER_14_2026, gregory, locale)).toBe(expected);
    });

    it('uses a custom separator', () => {
      expect(formatDateForField(OCTOBER_14_2026, gregory, ko, '-')).toBe('2026-10-14');
    });

    it('marks a lunar leap month with the locale prefix', () => {
      expect(formatDateForField(epochDayFromCivil(1990, 6, 23), dangi, ko)).toBe('1990. 윤05. 01');
    });

    it('throws when the day is outside the calendar range', () => {
      expect(() => formatDateForField(epochDayFromCivil(1899, 1, 1), dangi, ko)).toThrow(LunisolarPickerError);
    });
  });
});
