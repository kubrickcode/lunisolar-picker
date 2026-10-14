import { type CalendarSystem, epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from '../constraints/resolve-constraints';
import { en } from '../locales/en';
import { ja } from '../locales/ja';
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

  it('steps from the regular month when the leap flag names a leap month the year does not have', () => {
    const lunarContext = createTestContext({ calendars: [gregory, dangi] });
    const flaggedMarch = reduceEvents(
      dateFieldReducer,
      createDateFieldState(lunarContext, { selected: null, entryCalendarId: 'dangi' }),
      [...typed('19900301'), { type: 'segment.focus', index: 1 }, { type: 'leapMonth.toggle' }],
      lunarContext,
    );

    const april = dateFieldReducer(flaggedMarch, { type: 'segment.step', amount: 1 }, lunarContext);
    const february = dateFieldReducer(flaggedMarch, { type: 'segment.step', amount: -1 }, lunarContext);

    expect([april.segments[1]?.value, april.isLeapMonth]).toEqual([4, false]);
    expect([february.segments[1]?.value, february.isLeapMonth]).toEqual([2, false]);
  });

  it('wraps the Gregorian month from 12 to 1 without changing the year', () => {
    const december = reduceEvents(
      dateFieldReducer,
      emptyGregorian,
      [...typed('20261215'), { type: 'segment.focus', index: 1 }],
      koContext,
    );

    const stepped = dateFieldReducer(december, { type: 'segment.step', amount: 1 }, koContext);

    expect(stepped.segments.map((segment) => segment.value)).toEqual([2026, 1, 15]);
  });

  it('steps a typed month of 00 into 1 instead of throwing', () => {
    const zeroMonth = reduceEvents(
      dateFieldReducer,
      emptyGregorian,
      [...typed('199000'), { type: 'segment.focus', index: 1 }],
      koContext,
    );

    expect(dateFieldReducer(zeroMonth, { type: 'segment.step', amount: 1 }, koContext).segments[1]?.value).toBe(1);
  });

  it('ignores the leap toggle for Gregorian entry', () => {
    const state = dateFieldReducer(emptyGregorian, { type: 'leapMonth.toggle' }, koContext);

    expect(state).toBe(emptyGregorian);
  });

  it('decides leap month support from the calendar data rather than its id', () => {
    const leaplessCalendar: CalendarSystem = { ...gregory, id: 'dangi' };
    const context = createTestContext({ calendars: [gregory, leaplessCalendar] });
    const empty = createDateFieldState(context, { selected: null, entryCalendarId: 'dangi' });

    expect(dateFieldReducer(empty, { type: 'leapMonth.toggle' }, context)).toBe(empty);
  });

  describe('stepping within the entry calendar', () => {
    it.each([
      ['up past the last day of a 28-day month', 1, 1],
      ['down past the first day', -1, 28],
    ])('wraps the day %s', (_, amount, expectedDay) => {
      const typedDay = amount > 0 ? '28' : '01';
      const february = reduceEvents(
        dateFieldReducer,
        emptyGregorian,
        [...typed(`202602${typedDay}`), { type: 'segment.focus', index: 2 }],
        koContext,
      );

      expect(dateFieldReducer(february, { type: 'segment.step', amount }, koContext).segments[2]?.value).toBe(
        expectedDay,
      );
    });

    it('wraps the lunar year within the supported lunar years', () => {
      const lunarContext = createTestContext({ calendars: [gregory, dangi] });
      const lastYear = reduceEvents(
        dateFieldReducer,
        createDateFieldState(lunarContext, { selected: null, entryCalendarId: 'dangi' }),
        [...typed('20500101'), { type: 'segment.focus', index: 0 }],
        lunarContext,
      );

      expect(dateFieldReducer(lastYear, { type: 'segment.step', amount: 1 }, lunarContext).segments[0]?.value).toBe(
        1900,
      );
    });
  });

  describe('paste', () => {
    it.each([
      ['an ISO date into an English field', en, '1990-03-15'],
      ['an English date into an English field', en, '03/15/1990'],
      ['a Korean date with words into a Korean field', undefined, '1990년 3월 15일'],
      ['compact digits', undefined, '19900315'],
      ['compact digits in the English month-day-year order', en, '03151990'],
    ])('reads %s', (_, locale, text) => {
      const context = createTestContext(locale ? { locale } : {});
      const empty = createDateFieldState(context, { selected: null, entryCalendarId: 'gregory' });

      const state = dateFieldReducer(empty, { type: 'text.paste', text }, context);

      expect(dateFieldResult(state, context).epochDay).toBe(epochDayFromCivil(1990, 3, 15));
    });

    describe('leap month marker', () => {
      it.each([
        ['the Korean field prefix', undefined, '1990. 윤05. 01'],
        ['the Japanese field prefix', ja, '1990年閏5月1日'],
        ['the English lunar month name', en, 'Leap 5/1/1990'],
      ])('reads %s before the month digits as a leap month', (_, locale, text) => {
        const context = createTestContext({ calendars: [gregory, dangi], ...(locale ? { locale } : {}) });
        const empty = createDateFieldState(context, { selected: null, entryCalendarId: 'dangi' });

        const state = dateFieldReducer(empty, { type: 'text.paste', text }, context);

        expect(state.isLeapMonth).toBe(true);
        expect(dateFieldResult(state, context).epochDay).toBe(epochDayFromCivil(1990, 6, 23));
      });

      it('reads the same text without the marker as a regular month', () => {
        const lunarContext = createTestContext({ calendars: [gregory, dangi] });
        const empty = createDateFieldState(lunarContext, { selected: null, entryCalendarId: 'dangi' });

        const state = dateFieldReducer(empty, { type: 'text.paste', text: '1990. 05. 01' }, lunarContext);

        expect([state.segments[1]?.value, state.isLeapMonth]).toEqual([5, false]);
      });

      it('keeps the marker for Gregorian entry and reports the date as invalid', () => {
        const state = dateFieldReducer(emptyGregorian, { type: 'text.paste', text: '1990. 윤05. 01' }, koContext);

        expect(state.isLeapMonth).toBe(true);
        expect(dateFieldResult(state, koContext)).toEqual({
          epochDay: null,
          validity: { isValid: false, reasons: ['invalid-date'] },
        });
      });

      it('reads the English lunar month name in a Gregorian field as a leap marker when a lunar calendar is configured', () => {
        const enContext = createTestContext({ calendars: [gregory, dangi], locale: en });
        const empty = createDateFieldState(enContext, { selected: null, entryCalendarId: 'gregory' });

        expect(dateFieldReducer(empty, { type: 'text.paste', text: 'Leap 5/1/1990' }, enContext).isLeapMonth).toBe(
          true,
        );
      });

      it('takes the leap month name only from calendars that are configured and have leap months', () => {
        const enContext = createTestContext({ locale: en });
        const empty = createDateFieldState(enContext, { selected: null, entryCalendarId: 'gregory' });

        expect(dateFieldReducer(empty, { type: 'text.paste', text: 'Leap 5/1/1990' }, enContext).isLeapMonth).toBe(
          false,
        );
      });

      it('clears a pasted leap marker in a Gregorian field once the month is erased and retyped', () => {
        const pasted = dateFieldReducer(emptyGregorian, { type: 'text.paste', text: '1990. 윤05. 01' }, koContext);

        const retyped = reduceEvents(
          dateFieldReducer,
          pasted,
          [
            { type: 'segment.focus', index: 1 },
            { type: 'segment.erase' },
            { type: 'digit.type', digit: 0 },
            { type: 'digit.type', digit: 5 },
          ],
          koContext,
        );

        expect(retyped.isLeapMonth).toBe(false);
        expect(dateFieldResult(retyped, koContext)).toEqual({
          epochDay: epochDayFromCivil(1990, 5, 1),
          validity: { isValid: true, reasons: [] },
        });
      });

      it('clears a pasted leap marker in a Gregorian field when the month is stepped', () => {
        const pasted = dateFieldReducer(emptyGregorian, { type: 'text.paste', text: '1990. 윤05. 01' }, koContext);
        const focused = dateFieldReducer(pasted, { type: 'segment.focus', index: 1 }, koContext);

        const stepped = dateFieldReducer(focused, { type: 'segment.step', amount: 1 }, koContext);

        expect([stepped.segments[1]?.value, stepped.isLeapMonth]).toEqual([6, false]);
      });

      it('keeps a pasted leap marker in a Gregorian field while other segments are edited', () => {
        const pasted = dateFieldReducer(emptyGregorian, { type: 'text.paste', text: '1990. 윤05. 01' }, koContext);

        const edited = reduceEvents(
          dateFieldReducer,
          pasted,
          [{ type: 'segment.focus', index: 2 }, { type: 'segment.erase' }, { type: 'digit.type', digit: 2 }],
          koContext,
        );

        expect(edited.isLeapMonth).toBe(true);
      });
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

  it('moves on from a segment that already has a value when a separator is typed', () => {
    const filled = createDateFieldState(koContext, {
      selected: { epochDay: epochDayFromCivil(1990, 3, 15), calendarId: 'gregory' },
      entryCalendarId: 'gregory',
    });

    const state = reduceEvents(
      dateFieldReducer,
      filled,
      [{ type: 'segment.focus', index: 0 }, { type: 'separator.type' }],
      koContext,
    );

    expect(state.focusedIndex).toBe(1);
  });

  it('stays on an empty segment when a separator is typed', () => {
    const focused = dateFieldReducer(emptyGregorian, { type: 'segment.focus', index: 0 }, koContext);

    expect(dateFieldReducer(focused, { type: 'separator.type' }, koContext)).toBe(focused);
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

  it('leaves the segments empty instead of throwing for a day the entry calendar cannot represent', () => {
    const lunarContext = createTestContext({ calendars: [gregory, dangi] });
    const beyondLunarRange = { epochDay: epochDayFromCivil(2060, 1, 1), calendarId: 'dangi' } as const;
    const filled = createDateFieldState(lunarContext, {
      selected: { epochDay: epochDayFromCivil(2026, 10, 14), calendarId: 'dangi' },
      entryCalendarId: 'dangi',
    });

    const created = createDateFieldState(lunarContext, { selected: beyondLunarRange, entryCalendarId: 'dangi' });
    const synced = dateFieldReducer(
      filled,
      { type: 'value.sync', selected: beyondLunarRange, entryCalendarId: 'dangi' },
      lunarContext,
    );

    expect(created.segments.map((segment) => segment.value)).toEqual([null, null, null]);
    expect(synced.segments.map((segment) => segment.value)).toEqual([null, null, null]);
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
