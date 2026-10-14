import {
  brandEpochDay,
  type CalendarId,
  type CalendarSystem,
  type EpochDay,
  weekdayOf,
} from '@lunisolar-picker/calendar';
import { findCalendar, type PickerContext } from '../context';
import type { Reducer } from '../create-store';
import {
  boundsFor,
  clampEpochDay,
  constrainDateFields,
  epochDayOfFields,
  fieldsOf,
  supportedYearRange,
} from '../grid/calendar-math';
import {
  compareVisibleMonths,
  isSameVisibleMonth,
  shiftVisibleMonth,
  visibleMonthOf,
  yearPageStartOf,
} from '../grid/visible-month';
import type { VisibleMonth } from '../types';

const DAYS_PER_WEEK = 7;
export const YEAR_PAGE_SIZE = 12;

export type CalendarView = 'days' | 'months' | 'years';
export type FocusUnit = 'day' | 'week' | 'month' | 'year';

type CapVisibleMonthOptions = {
  readonly calendar: CalendarSystem;
  readonly numberOfMonths: number;
  readonly visibleMonth: VisibleMonth;
};

type FirstVisibleMonthOptions = {
  readonly calendar: CalendarSystem;
  readonly focusedEpochDay: EpochDay;
  readonly numberOfMonths: number;
};

type KeepFocusVisibleOptions = {
  readonly calendar: CalendarSystem;
  readonly focusedEpochDay: EpochDay;
  readonly numberOfMonths: number;
  readonly visibleMonth: VisibleMonth;
};

type MovedEpochDayOptions = {
  readonly amount: number;
  readonly calendar: CalendarSystem;
  readonly epochDay: EpochDay;
  readonly unit: FocusUnit;
};

export type NavigationEvent =
  | { readonly type: 'calendar.set'; readonly calendarId: CalendarId }
  | { readonly type: 'focus.move'; readonly unit: FocusUnit; readonly amount: number }
  | { readonly type: 'focus.set'; readonly epochDay: EpochDay }
  | { readonly type: 'focus.weekEdge'; readonly edge: WeekEdge }
  | { readonly type: 'month.pick'; readonly month: VisibleMonth }
  | { readonly type: 'month.shift'; readonly amount: number }
  | { readonly type: 'today.go' }
  | { readonly type: 'view.set'; readonly view: CalendarView }
  | { readonly type: 'year.pick'; readonly year: number }
  | { readonly type: 'yearPage.shift'; readonly amount: number };

type NavigationScope = {
  readonly calendar: CalendarSystem;
  readonly context: PickerContext;
  readonly state: NavigationState;
};

export interface NavigationState {
  readonly displayCalendarId: CalendarId;
  readonly focusedEpochDay: EpochDay;
  readonly view: CalendarView;
  readonly visibleMonth: VisibleMonth;
  readonly yearPageStart: number;
}

type WeekEdge = 'start' | 'end';

type WeekEdgeOptions = {
  readonly context: PickerContext;
  readonly edge: WeekEdge;
  readonly epochDay: EpochDay;
};

export const createNavigationState = (
  context: PickerContext,
  initial: { readonly focusedEpochDay?: EpochDay; readonly displayCalendarId?: CalendarId } = {},
): NavigationState => {
  const displayCalendarId = initial.displayCalendarId ?? 'gregory';
  const calendar = findCalendar(context.calendars, displayCalendarId);
  const focusedEpochDay = clampEpochDay(
    initial.focusedEpochDay ?? context.today,
    boundsFor(calendar, context.constraints),
  );
  const visibleMonth = firstVisibleMonthFor({ calendar, focusedEpochDay, numberOfMonths: context.numberOfMonths });
  return {
    displayCalendarId,
    focusedEpochDay,
    view: 'days',
    visibleMonth,
    yearPageStart: yearPageStartOf(visibleMonth.year, YEAR_PAGE_SIZE),
  };
};

export const navigationReducer: Reducer<NavigationState, NavigationEvent, PickerContext> = (state, event, context) => {
  const calendar = findCalendar(context.calendars, state.displayCalendarId);
  const scope: NavigationScope = { calendar, context, state };
  switch (event.type) {
    case 'month.shift':
      return shiftMonths(scope, event.amount);
    case 'today.go':
      return mergeNavigation(state, { ...focusAsFirstMonth(scope, context.today), view: 'days' });
    case 'focus.set':
      return focusOn(scope, event.epochDay);
    case 'focus.move':
      return focusOn(
        scope,
        movedEpochDay({ amount: event.amount, calendar, epochDay: state.focusedEpochDay, unit: event.unit }),
      );
    case 'focus.weekEdge':
      return focusOn(scope, weekEdgeOf({ context, edge: event.edge, epochDay: state.focusedEpochDay }));
    case 'view.set':
      return mergeNavigation(state, {
        view: event.view,
        yearPageStart:
          event.view === 'years' ? yearPageStartOf(state.visibleMonth.year, YEAR_PAGE_SIZE) : state.yearPageStart,
      });
    case 'month.pick':
      return pickMonth(scope, event.month);
    case 'year.pick':
      return pickYear(scope, event.year);
    case 'yearPage.shift':
      return shiftYearPage(scope, event.amount);
    case 'calendar.set':
      return switchCalendar(scope, event.calendarId);
  }
};

const focusOn = ({ calendar, context, state }: NavigationScope, epochDay: EpochDay): NavigationState => {
  const focusedEpochDay = clampEpochDay(epochDay, boundsFor(calendar, context.constraints));
  const visibleMonth = keepFocusVisible({
    calendar,
    focusedEpochDay,
    numberOfMonths: context.numberOfMonths,
    visibleMonth: state.visibleMonth,
  });
  return mergeNavigation(state, { focusedEpochDay, visibleMonth });
};

const focusAsFirstMonth = (
  { calendar, context }: NavigationScope,
  epochDay: EpochDay,
): Pick<NavigationState, 'focusedEpochDay' | 'visibleMonth'> => {
  const focusedEpochDay = clampEpochDay(epochDay, boundsFor(calendar, context.constraints));
  return {
    focusedEpochDay,
    visibleMonth: firstVisibleMonthFor({ calendar, focusedEpochDay, numberOfMonths: context.numberOfMonths }),
  };
};

const firstVisibleMonthFor = ({ calendar, focusedEpochDay, numberOfMonths }: FirstVisibleMonthOptions): VisibleMonth =>
  capVisibleMonth({ calendar, numberOfMonths, visibleMonth: visibleMonthOf(calendar, focusedEpochDay) });

// Constraint: 여러 달을 나란히 보여 줄 때 첫 달·마지막 달이 역법의 지원 달 밖으로 나가면 그 칸에 그릴 달이 없음
const capVisibleMonth = ({ calendar, numberOfMonths, visibleMonth }: CapVisibleMonthOptions): VisibleMonth => {
  const firstMonth = visibleMonthOf(calendar, calendar.supportedRange.min);
  const latestFirstMonth = shiftVisibleMonth(
    calendar,
    visibleMonthOf(calendar, calendar.supportedRange.max),
    -(numberOfMonths - 1),
  );
  if (compareVisibleMonths(calendar, visibleMonth, firstMonth) < 0) return firstMonth;
  return compareVisibleMonths(calendar, visibleMonth, latestFirstMonth) > 0 ? latestFirstMonth : visibleMonth;
};

// Goal: 여러 달을 보여 줄 때 포커스가 보이는 달 안에서 움직이면 화면을 흔들지 않음
const keepFocusVisible = ({
  calendar,
  focusedEpochDay,
  numberOfMonths,
  visibleMonth,
}: KeepFocusVisibleOptions): VisibleMonth => {
  const focusMonth = visibleMonthOf(calendar, focusedEpochDay);
  if (compareVisibleMonths(calendar, focusMonth, visibleMonth) < 0) return focusMonth;
  const lastVisibleMonth = shiftVisibleMonth(calendar, visibleMonth, numberOfMonths - 1);
  if (compareVisibleMonths(calendar, focusMonth, lastVisibleMonth) <= 0) return visibleMonth;
  return shiftVisibleMonth(calendar, focusMonth, -(numberOfMonths - 1));
};

const shiftMonths = ({ calendar, context, state }: NavigationScope, amount: number): NavigationState => {
  const visibleMonth = capVisibleMonth({
    calendar,
    numberOfMonths: context.numberOfMonths,
    visibleMonth: shiftVisibleMonth(calendar, state.visibleMonth, amount),
  });
  const focusedEpochDay = clampEpochDay(
    movedEpochDay({ amount, calendar, epochDay: state.focusedEpochDay, unit: 'month' }),
    boundsFor(calendar, context.constraints),
  );
  return mergeNavigation(state, {
    focusedEpochDay,
    visibleMonth: keepFocusVisible({
      calendar,
      focusedEpochDay,
      numberOfMonths: context.numberOfMonths,
      visibleMonth,
    }),
  });
};

const movedEpochDay = ({ amount, calendar, epochDay, unit }: MovedEpochDayOptions): EpochDay => {
  if (unit === 'day') return brandEpochDay(epochDay + amount);
  if (unit === 'week') return brandEpochDay(epochDay + amount * DAYS_PER_WEEK);
  const fields = fieldsOf(calendar, epochDay);
  if (unit === 'year') {
    return epochDayOfFields(calendar, constrainDateFields(calendar, { ...fields, year: fields.year + amount }));
  }
  const targetMonth = shiftVisibleMonth(calendar, { monthCode: fields.monthCode, year: fields.year }, amount);
  return epochDayOfFields(calendar, constrainDateFields(calendar, { ...targetMonth, day: fields.day }));
};

const weekEdgeOf = ({ context, edge, epochDay }: WeekEdgeOptions): EpochDay => {
  const offsetFromStart = (weekdayOf(epochDay) - context.weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const weekStart = epochDay - offsetFromStart;
  return brandEpochDay(edge === 'start' ? weekStart : weekStart + DAYS_PER_WEEK - 1);
};

const pickMonth = (scope: NavigationScope, month: VisibleMonth): NavigationState => {
  const { calendar, state } = scope;
  const focusDay = fieldsOf(calendar, state.focusedEpochDay).day;
  const fields = constrainDateFields(calendar, { ...month, day: focusDay });
  return mergeNavigation(state, { ...focusAsFirstMonth(scope, epochDayOfFields(calendar, fields)), view: 'days' });
};

// Goal: 연도를 고르면 포커스도 그해로 옮김. 그래야 이어지는 달 이동·키보드 이동이 고른 해에서 시작함
const pickYear = (scope: NavigationScope, year: number): NavigationState => {
  const { calendar, state } = scope;
  const fields = constrainDateFields(calendar, { ...fieldsOf(calendar, state.focusedEpochDay), year });
  return mergeNavigation(state, { ...focusAsFirstMonth(scope, epochDayOfFields(calendar, fields)), view: 'months' });
};

const shiftYearPage = ({ calendar, state }: NavigationScope, amount: number): NavigationState => {
  const { firstYear, lastYear } = supportedYearRange(calendar);
  const firstPageStart = yearPageStartOf(firstYear, YEAR_PAGE_SIZE);
  const lastPageStart = yearPageStartOf(lastYear, YEAR_PAGE_SIZE);
  const yearPageStart = Math.min(
    Math.max(state.yearPageStart + amount * YEAR_PAGE_SIZE, firstPageStart),
    lastPageStart,
  );
  return mergeNavigation(state, { yearPageStart });
};

const switchCalendar = ({ context, state }: NavigationScope, calendarId: CalendarId): NavigationState => {
  if (calendarId === state.displayCalendarId) return state;
  const calendar = findCalendar(context.calendars, calendarId);
  const focus = focusAsFirstMonth({ calendar, context, state }, state.focusedEpochDay);
  return mergeNavigation(state, {
    ...focus,
    displayCalendarId: calendarId,
    yearPageStart: yearPageStartOf(focus.visibleMonth.year, YEAR_PAGE_SIZE),
  });
};

// Constraint: 바뀐 값이 없으면 같은 참조를 돌려줘야 createStore가 구독자를 깨우지 않음
const mergeNavigation = (state: NavigationState, changes: Partial<NavigationState>): NavigationState => {
  const next = { ...state, ...changes };
  const isUnchanged =
    next.displayCalendarId === state.displayCalendarId &&
    isSameVisibleMonth(next.visibleMonth, state.visibleMonth) &&
    next.focusedEpochDay === state.focusedEpochDay &&
    next.view === state.view &&
    next.yearPageStart === state.yearPageStart;
  return isUnchanged ? state : next;
};
