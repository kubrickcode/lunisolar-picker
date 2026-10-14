import { type DateFields, type EpochDay, epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from '../constraints/resolve-constraints';
import { createTestContext, TEST_TODAY } from '../testing/create-test-context';
import { reduceEvents } from '../testing/reduce-events';
import { createNavigationState, type NavigationEvent, navigationReducer } from './navigation';

const solar = (year: number, month: number, day: number): EpochDay => epochDayFromCivil(year, month, day);

const lunar = (fields: DateFields): EpochDay => {
  const epochDay = dangi.toEpochDay(fields);
  if (!epochDay.isOk) throw new Error(`test lunar date ${JSON.stringify(fields)} is not valid: ${epochDay.error}`);
  return epochDay.value;
};

describe('navigation', () => {
  const context = createTestContext();
  const lunarContext = createTestContext({ calendars: [gregory, dangi] });

  it('starts focused on today in the Gregorian calendar', () => {
    expect(createNavigationState(context)).toEqual({
      displayCalendarId: 'gregory',
      visibleMonth: { year: 2026, monthCode: 'M10' },
      focusedEpochDay: TEST_TODAY,
      view: 'days',
      yearPageStart: 2016,
    });
  });

  describe('focus movement', () => {
    it('lands on the last day of a shorter month instead of spilling into the next month', () => {
      const state = createNavigationState(context, { focusedEpochDay: solar(2026, 1, 31) });

      const next = navigationReducer(state, { type: 'focus.move', unit: 'month', amount: 1 }, context);

      expect(next.focusedEpochDay).toBe(solar(2026, 2, 28));
      expect(next.visibleMonth).toEqual({ year: 2026, monthCode: 'M02' });
    });

    it('moves by days and weeks', () => {
      const events: NavigationEvent[] = [
        { type: 'focus.move', unit: 'day', amount: 1 },
        { type: 'focus.move', unit: 'week', amount: -1 },
      ];

      expect(reduceEvents(navigationReducer, createNavigationState(context), events, context).focusedEpochDay).toBe(
        solar(2026, 10, 8),
      );
    });

    it('returns the same state when focus is already at the maximum', () => {
      const bounded = createTestContext({ constraints: resolveConstraints({ max: '2026-10-14' }) });
      const state = createNavigationState(bounded);

      expect(navigationReducer(state, { type: 'focus.move', unit: 'day', amount: 1 }, bounded)).toBe(state);
    });

    it('clamps a focus request below the minimum', () => {
      const bounded = createTestContext({ constraints: resolveConstraints({ min: '2026-10-01' }) });

      const next = navigationReducer(
        createNavigationState(bounded),
        { type: 'focus.set', epochDay: solar(2026, 9, 1) },
        bounded,
      );

      expect(next.focusedEpochDay).toBe(solar(2026, 10, 1));
    });

    it.each([
      [0, 'start', solar(2026, 10, 11)],
      [1, 'start', solar(2026, 10, 12)],
      [0, 'end', solar(2026, 10, 17)],
    ] as const)('moves to the week edge with weekStartsOn %i (%s)', (weekStartsOn, edge, expected) => {
      const weekContext = createTestContext({ weekStartsOn });

      const next = navigationReducer(createNavigationState(weekContext), { type: 'focus.weekEdge', edge }, weekContext);

      expect(next.focusedEpochDay).toBe(expected);
    });
  });

  describe('visible months', () => {
    it('shifts the visible month and carries the focused day number', () => {
      const next = navigationReducer(createNavigationState(context), { type: 'month.shift', amount: 1 }, context);

      expect(next.visibleMonth).toEqual({ year: 2026, monthCode: 'M11' });
      expect(next.focusedEpochDay).toBe(solar(2026, 11, 14));
    });

    it('keeps both months on screen while focus moves into the second of two visible months', () => {
      const twoMonths = createTestContext({ numberOfMonths: 2 });
      const state = createNavigationState(twoMonths);

      const intoSecond = navigationReducer(state, { type: 'focus.set', epochDay: solar(2026, 11, 5) }, twoMonths);
      const pastSecond = navigationReducer(intoSecond, { type: 'focus.set', epochDay: solar(2026, 12, 1) }, twoMonths);

      expect(intoSecond.visibleMonth).toEqual({ year: 2026, monthCode: 'M10' });
      expect(pastSecond.visibleMonth).toEqual({ year: 2026, monthCode: 'M11' });
    });

    it('jumps back to today', () => {
      const state = createNavigationState(context, { focusedEpochDay: solar(2020, 1, 1) });

      const next = navigationReducer(state, { type: 'today.go' }, context);

      expect(next.focusedEpochDay).toBe(TEST_TODAY);
      expect(next.visibleMonth).toEqual({ year: 2026, monthCode: 'M10' });
    });
  });

  describe('views', () => {
    it('opens the year page around the visible year and pages by twelve years', () => {
      const years = navigationReducer(createNavigationState(context), { type: 'view.set', view: 'years' }, context);
      const previousPage = navigationReducer(years, { type: 'yearPage.shift', amount: -1 }, context);

      expect(years.yearPageStart).toBe(2016);
      expect(previousPage.yearPageStart).toBe(2004);
    });

    it('goes from year to month to day views', () => {
      const events: NavigationEvent[] = [
        { type: 'view.set', view: 'years' },
        { type: 'year.pick', year: 2030 },
      ];
      const monthsView = reduceEvents(navigationReducer, createNavigationState(context), events, context);
      const daysView = navigationReducer(
        monthsView,
        { type: 'month.pick', month: { year: 2030, monthCode: 'M02' } },
        context,
      );

      expect(monthsView).toMatchObject({ view: 'months', visibleMonth: { year: 2030, monthCode: 'M10' } });
      expect(daysView).toMatchObject({ view: 'days', visibleMonth: { year: 2030, monthCode: 'M02' } });
      expect(daysView.focusedEpochDay).toBe(solar(2030, 2, 14));
    });
  });

  describe('year picking', () => {
    it('moves focus into the picked year so the next month shift stays in that year', () => {
      const events: NavigationEvent[] = [
        { type: 'view.set', view: 'years' },
        { type: 'year.pick', year: 2030 },
        { type: 'view.set', view: 'days' },
        { type: 'month.shift', amount: 1 },
      ];

      const next = reduceEvents(navigationReducer, createNavigationState(context), events, context);

      expect(next.visibleMonth).toEqual({ year: 2030, monthCode: 'M11' });
      expect(next.focusedEpochDay).toBe(solar(2030, 11, 14));
    });

    it('clamps a lunar pick into the last supported year and keeps both visible months inside the range', () => {
      const twoLunarMonths = createTestContext({ calendars: [gregory, dangi], numberOfMonths: 2 });
      const state = createNavigationState(twoLunarMonths, {
        focusedEpochDay: lunar({ year: 2049, monthCode: 'M12', day: 15 }),
        displayCalendarId: 'dangi',
      });

      const next = navigationReducer(state, { type: 'year.pick', year: 2050 }, twoLunarMonths);

      expect(dangi.fromEpochDay(next.focusedEpochDay)).toEqual({
        isOk: true,
        value: { year: 2050, monthCode: 'M11', day: 15 },
      });
      expect(next).toMatchObject({ view: 'months', visibleMonth: { year: 2050, monthCode: 'M10' } });
    });
  });

  describe('edges and identity', () => {
    it('stays put when stepping a month past the last supported lunar month', () => {
      const state = createNavigationState(lunarContext, {
        focusedEpochDay: dangi.supportedRange.max,
        displayCalendarId: 'dangi',
      });

      expect(navigationReducer(state, { type: 'focus.move', unit: 'month', amount: 1 }, lunarContext)).toBe(state);
    });

    it('keeps the last of two visible months on the last supported lunar month when shifting forward', () => {
      const twoLunarMonths = createTestContext({ calendars: [gregory, dangi], numberOfMonths: 2 });
      const state = createNavigationState(twoLunarMonths, {
        focusedEpochDay: lunar({ year: 2050, monthCode: 'M10', day: 1 }),
        displayCalendarId: 'dangi',
      });

      const next = navigationReducer(state, { type: 'month.shift', amount: 1 }, twoLunarMonths);

      expect(state.visibleMonth).toEqual({ year: 2050, monthCode: 'M10' });
      expect(next.visibleMonth).toEqual({ year: 2050, monthCode: 'M10' });
    });

    it('clamps to the last lunar day when the focus lies beyond the lunar range', () => {
      const state = createNavigationState(lunarContext, { focusedEpochDay: solar(2060, 1, 1) });

      const next = navigationReducer(state, { type: 'calendar.set', calendarId: 'dangi' }, lunarContext);

      expect(next.focusedEpochDay).toBe(dangi.supportedRange.max);
    });

    it('shifts the view back when focus moves before the first of two visible months', () => {
      const twoMonths = createTestContext({ numberOfMonths: 2 });

      const next = navigationReducer(
        createNavigationState(twoMonths),
        { type: 'focus.set', epochDay: solar(2026, 9, 20) },
        twoMonths,
      );

      expect(next.visibleMonth).toEqual({ year: 2026, monthCode: 'M09' });
    });

    it('returns the same state when setting the current view', () => {
      const state = createNavigationState(lunarContext);

      expect(navigationReducer(state, { type: 'view.set', view: 'days' }, lunarContext)).toBe(state);
    });

    it('returns the same state when setting the current calendar', () => {
      const state = createNavigationState(lunarContext);

      expect(navigationReducer(state, { type: 'calendar.set', calendarId: 'gregory' }, lunarContext)).toBe(state);
    });
  });

  describe('lunar display', () => {
    it('keeps the focused day while switching the grid to the lunar calendar', () => {
      const next = navigationReducer(
        createNavigationState(lunarContext),
        { type: 'calendar.set', calendarId: 'dangi' },
        lunarContext,
      );

      expect(next.focusedEpochDay).toBe(TEST_TODAY);
      expect(next.visibleMonth).toEqual({ year: 2026, monthCode: 'M09' });
    });

    it('moves a year from a leap month to the regular month when the next year has no such leap month', () => {
      const state = createNavigationState(lunarContext, {
        focusedEpochDay: solar(2025, 7, 25),
        displayCalendarId: 'dangi',
      });

      const next = navigationReducer(state, { type: 'focus.move', unit: 'year', amount: 1 }, lunarContext);

      expect(dangi.fromEpochDay(next.focusedEpochDay)).toEqual({
        isOk: true,
        value: { year: 2026, monthCode: 'M06', day: 1 },
      });
    });

    it('steps month by month through a leap month', () => {
      const state = createNavigationState(lunarContext, {
        focusedEpochDay: solar(2025, 7, 1),
        displayCalendarId: 'dangi',
      });

      const next = navigationReducer(state, { type: 'month.shift', amount: 1 }, lunarContext);

      expect(next.visibleMonth).toEqual({ year: 2025, monthCode: 'M06L' });
    });
  });
});
