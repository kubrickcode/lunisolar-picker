import { epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from '../constraints/resolve-constraints';
import { en } from '../locales/en';
import { createTestContext } from '../testing/create-test-context';
import { reduceEvents } from '../testing/reduce-events';
import { createDateFieldState, type DateFieldEvent, dateFieldReducer, dateFieldResult } from './date-field';

function typed(digits: string): DateFieldEvent[] {
  return [
    { type: 'segment.focus', index: 0 },
    ...[...digits].map((digit) => ({ type: 'digit.type', digit: Number(digit) }) as const),
  ];
}

describe('date field', () => {
  const koContext = createTestContext();
  const emptyGregorian = createDateFieldState(koContext, { selected: null, entryCalendarId: 'gregory' });

  it('orders segments by locale', () => {
    const enState = createDateFieldState(createTestContext({ locale: en }), {
      selected: null,
      entryCalendarId: 'gregory',
    });

    expect(emptyGregorian.segments.map((segment) => segment.kind)).toEqual(['year', 'month', 'day']);
    expect(enState.segments.map((segment) => segment.kind)).toEqual(['month', 'day', 'year']);
  });

  it('reads eight typed digits as a full date', () => {
    const state = reduceEvents(dateFieldReducer, emptyGregorian, typed('19900315'), koContext);

    expect(dateFieldResult(state, koContext)).toEqual({
      epochDay: epochDayFromCivil(1990, 3, 15),
      validity: { isValid: true, reasons: [] },
    });
  });

  it('reads eight typed digits in the English month-day-year order', () => {
    const enContext = createTestContext({ locale: en });
    const state = reduceEvents(
      dateFieldReducer,
      createDateFieldState(enContext, { selected: null, entryCalendarId: 'gregory' }),
      typed('03151990'),
      enContext,
    );

    expect(dateFieldResult(state, enContext).epochDay).toBe(epochDayFromCivil(1990, 3, 15));
  });

  it('keeps an impossible Gregorian date as typed and reports it instead of correcting it', () => {
    const state = reduceEvents(dateFieldReducer, emptyGregorian, typed('20260230'), koContext);

    expect(state.segments.map((segment) => segment.value)).toEqual([2026, 2, 30]);
    expect(dateFieldResult(state, koContext)).toEqual({
      epochDay: null,
      validity: { isValid: false, reasons: ['invalid-date'] },
    });
  });

  it('accepts a lunar day 30 in a 30-day lunar month', () => {
    const lunarContext = createTestContext({ calendars: [gregory, dangi] });
    const yearWithLongSecondMonth = Array.from({ length: 41 }, (_, index) => 1990 + index).find(
      (year) => dangi.daysInMonth(year, 'M02') === 30,
    );
    if (yearWithLongSecondMonth === undefined)
      throw new Error('expected a 30-day second lunar month between 1990 and 2030');
    const empty = createDateFieldState(lunarContext, { selected: null, entryCalendarId: 'dangi' });

    const state = reduceEvents(dateFieldReducer, empty, typed(`${yearWithLongSecondMonth}0230`), lunarContext);

    expect(dateFieldResult(state, lunarContext).validity.isValid).toBe(true);
  });

  it('enters a lunar leap month with the leap toggle on the month segment', () => {
    const lunarContext = createTestContext({ calendars: [gregory, dangi] });
    const empty = createDateFieldState(lunarContext, { selected: null, entryCalendarId: 'dangi' });

    const state = reduceEvents(
      dateFieldReducer,
      empty,
      [...typed('19900501'), { type: 'segment.focus', index: 1 }, { type: 'leapMonth.toggle' }],
      lunarContext,
    );

    expect(dateFieldResult(state, lunarContext).epochDay).toBe(epochDayFromCivil(1990, 6, 23));
  });

  it('steps the month through the lunar leap month', () => {
    const lunarContext = createTestContext({ calendars: [gregory, dangi] });
    const may1990 = reduceEvents(
      dateFieldReducer,
      createDateFieldState(lunarContext, { selected: null, entryCalendarId: 'dangi' }),
      [...typed('19900501'), { type: 'segment.focus', index: 1 }],
      lunarContext,
    );

    const leap = dateFieldReducer(may1990, { type: 'segment.step', amount: 1 }, lunarContext);
    const june = dateFieldReducer(leap, { type: 'segment.step', amount: 1 }, lunarContext);

    expect([leap.segments[1]?.value, leap.isLeapMonth]).toEqual([5, true]);
    expect([june.segments[1]?.value, june.isLeapMonth]).toEqual([6, false]);
  });

  it('ignores the leap toggle for Gregorian entry', () => {
    const state = dateFieldReducer(emptyGregorian, { type: 'leapMonth.toggle' }, koContext);

    expect(state).toBe(emptyGregorian);
  });

  describe('paste', () => {
    it.each([
      ['an ISO date into an English field', en, '1990-03-15'],
      ['an English date into an English field', en, '03/15/1990'],
      ['a Korean date with words into a Korean field', undefined, '1990년 3월 15일'],
      ['compact digits', undefined, '19900315'],
    ])('reads %s', (_, locale, text) => {
      const context = createTestContext(locale ? { locale } : {});
      const empty = createDateFieldState(context, { selected: null, entryCalendarId: 'gregory' });

      const state = dateFieldReducer(empty, { type: 'text.paste', text }, context);

      expect(dateFieldResult(state, context).epochDay).toBe(epochDayFromCivil(1990, 3, 15));
    });

    it('leaves the field untouched for text it cannot read', () => {
      expect(dateFieldReducer(emptyGregorian, { type: 'text.paste', text: 'tomorrow' }, koContext)).toBe(
        emptyGregorian,
      );
    });
  });

  it('treats an empty field as valid and a partial field as incomplete', () => {
    const partial = reduceEvents(dateFieldReducer, emptyGregorian, typed('1990'), koContext);

    expect(dateFieldResult(emptyGregorian, koContext)).toEqual({
      epochDay: null,
      validity: { isValid: true, reasons: [] },
    });
    expect(dateFieldResult(partial, koContext).validity.reasons).toEqual(['incomplete']);
  });

  it('moves to the next segment when a separator is typed after a single digit', () => {
    const state = reduceEvents(
      dateFieldReducer,
      emptyGregorian,
      [{ type: 'segment.focus', index: 1 }, { type: 'digit.type', digit: 1 }, { type: 'separator.type' }],
      koContext,
    );

    expect(state.focusedIndex).toBe(2);
  });

  it('reports the constraint reason for a complete date outside the bounds', () => {
    const bounded = createTestContext({ constraints: resolveConstraints({ min: '2000-01-01' }) });
    const empty = createDateFieldState(bounded, { selected: null, entryCalendarId: 'gregory' });

    const state = reduceEvents(dateFieldReducer, empty, typed('19900315'), bounded);

    expect(dateFieldResult(state, bounded)).toEqual({
      epochDay: epochDayFromCivil(1990, 3, 15),
      validity: { isValid: false, reasons: ['before-min'] },
    });
  });

  it('refills segments from the new calendar when switching an entered date to lunar', () => {
    const lunarContext = createTestContext({ calendars: [gregory, dangi] });
    const solar = createDateFieldState(lunarContext, {
      selected: { epochDay: epochDayFromCivil(1990, 6, 23), calendarId: 'gregory' },
      entryCalendarId: 'gregory',
    });

    const lunar = dateFieldReducer(solar, { type: 'calendar.set', calendarId: 'dangi' }, lunarContext);

    expect(lunar.segments.map((segment) => segment.value)).toEqual([1990, 5, 1]);
    expect(lunar.isLeapMonth).toBe(true);
  });

  describe('no-op events', () => {
    it('keeps the same state when erasing an empty focused segment', () => {
      const focused = dateFieldReducer(emptyGregorian, { type: 'segment.focus', index: 0 }, koContext);

      expect(dateFieldReducer(focused, { type: 'segment.erase' }, koContext)).toBe(focused);
    });

    it('keeps the same state when the same value is synced again', () => {
      const selected = { epochDay: epochDayFromCivil(1990, 3, 15), calendarId: 'gregory' } as const;
      const focused = dateFieldReducer(
        createDateFieldState(koContext, { selected, entryCalendarId: 'gregory' }),
        { type: 'segment.focus', index: 1 },
        koContext,
      );

      expect(dateFieldReducer(focused, { type: 'value.sync', selected, entryCalendarId: 'gregory' }, koContext)).toBe(
        focused,
      );
    });
  });

  describe('stepping an empty segment', () => {
    it('starts from today', () => {
      const focused = dateFieldReducer(emptyGregorian, { type: 'segment.focus', index: 0 }, koContext);

      expect(dateFieldReducer(focused, { type: 'segment.step', amount: 1 }, koContext).segments[0]?.value).toBe(2026);
    });

    it('starts from the last supported lunar year when today is past the lunar range', () => {
      const lateContext = createTestContext({ calendars: [gregory, dangi], today: epochDayFromCivil(2060, 1, 1) });
      const focused = dateFieldReducer(
        createDateFieldState(lateContext, { selected: null, entryCalendarId: 'dangi' }),
        { type: 'segment.focus', index: 0 },
        lateContext,
      );

      expect(dateFieldReducer(focused, { type: 'segment.step', amount: 1 }, lateContext).segments[0]?.value).toBe(2050);
    });
  });
});
