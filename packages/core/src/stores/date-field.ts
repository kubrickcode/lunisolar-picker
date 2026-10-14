import {
  type CalendarId,
  type CalendarSystem,
  type EpochDay,
  gregory,
  type MonthCode,
  parseMonthCode,
  toMonthCode,
} from '@lunisolar-picker/calendar';
import { validateEpochDay } from '../constraints/validate';
import { findCalendar, type PickerContext } from '../context';
import type { Reducer } from '../create-store';
import { clampEpochDay, fieldsOf, supportedYearRange } from '../grid/calendar-math';
import { type DateSegmentKind, invalidBecause, VALID, type Validity } from '../types';
import {
  createSegment,
  reduceSegmentEvent,
  replaceFocusedSegment,
  type Segment,
  type SegmentEvent,
  type SegmentGroup,
  type SegmentLimits,
  withSegmentValue,
} from './segment';
import type { SelectedDay } from './selectable';

const COMPACT_DATE_LENGTH = 8;
const ISO_ORDER: readonly DateSegmentKind[] = ['year', 'month', 'day'];
const MONTH_DIGITS = 2;
const SEGMENT_LIMITS: Readonly<Record<DateSegmentKind, SegmentLimits>> = {
  year: { minValue: 1, maxValue: 9999, maxDigits: 4 },
  month: { minValue: 1, maxValue: 12, maxDigits: 2 },
  // Constraint: 달 길이는 연·월이 다 들어와야 알 수 있어 입력 중에는 31까지 받고, 결과에서 역법이 판정함 (스펙 5.4)
  day: { minValue: 1, maxValue: 31, maxDigits: 2 },
};
const YEAR_DIGITS = 4;

type DateFieldInitial = {
  readonly entryCalendarId: CalendarId;
  readonly selected: SelectedDay | null;
};

export type DateFieldEvent =
  | SegmentEvent
  | { readonly type: 'text.paste'; readonly text: string }
  | { readonly type: 'leapMonth.toggle' }
  | { readonly type: 'calendar.set'; readonly calendarId: CalendarId }
  | { readonly type: 'value.sync'; readonly selected: SelectedDay | null; readonly entryCalendarId: CalendarId };

export interface DateFieldResult {
  readonly epochDay: EpochDay | null;
  readonly validity: Validity;
}

type DateFieldScope = {
  readonly context: PickerContext;
  readonly state: DateFieldState;
};

export interface DateFieldState extends SegmentGroup<DateSegmentKind> {
  readonly isLeapMonth: boolean;
  readonly entryCalendarId: CalendarId;
}

type DateParts = Readonly<Record<DateSegmentKind, number>>;

type DatePartsOfDay = {
  readonly isLeapMonth: boolean;
  readonly values: DateParts;
};

export const createDateFieldState = (context: PickerContext, initial: DateFieldInitial): DateFieldState => {
  const calendarId = initial.selected?.calendarId ?? initial.entryCalendarId;
  const parts =
    initial.selected === null ? null : partsOf(findCalendar(context.calendars, calendarId), initial.selected.epochDay);
  return {
    segments: context.locale.field.order.map((kind) =>
      createSegment(kind, SEGMENT_LIMITS[kind], parts?.values[kind] ?? null),
    ),
    focusedIndex: null,
    isLeapMonth: parts?.isLeapMonth ?? false,
    entryCalendarId: calendarId,
  };
};

export const dateFieldReducer: Reducer<DateFieldState, DateFieldEvent, PickerContext> = (state, event, context) => {
  switch (event.type) {
    case 'text.paste':
      return pasteDate({ context, state }, event.text);
    case 'leapMonth.toggle':
      return state.entryCalendarId === gregory.id ? state : { ...state, isLeapMonth: !state.isLeapMonth };
    case 'calendar.set':
      return switchEntryCalendar({ context, state }, event.calendarId);
    case 'value.sync':
      return syncValue({ context, state }, event);
    case 'segment.step':
      return stepDateSegment({ context, state }, event.amount);
    default:
      return reduceSegmentEvent<DateSegmentKind, DateFieldState>(state, event, (kind) =>
        todayPart({ context, state }, kind),
      );
  }
};

export const dateFieldResult = (state: DateFieldState, context: PickerContext): DateFieldResult => {
  const values = state.segments.map((segment) => segment.value);
  if (values.every((value) => value === null)) return { epochDay: null, validity: VALID };
  if (values.some((value) => value === null)) return { epochDay: null, validity: invalidBecause(['incomplete']) };
  const parts = partsFromSegments(state.segments);
  if (parts.month < 1 || parts.month > 12 || parts.year < 1 || parts.day < 1) {
    return { epochDay: null, validity: invalidBecause(['invalid-date']) };
  }
  const calendar = findCalendar(context.calendars, state.entryCalendarId);
  const epochDay = calendar.toEpochDay({
    year: parts.year,
    monthCode: toMonthCode(parts.month, state.isLeapMonth),
    day: parts.day,
  });
  if (!epochDay.isOk) return { epochDay: null, validity: invalidBecause([epochDay.error]) };
  return { epochDay: epochDay.value, validity: validateEpochDay(epochDay.value, context.constraints) };
};

const partsOf = (calendar: CalendarSystem, epochDay: EpochDay): DatePartsOfDay => {
  const fields = fieldsOf(calendar, epochDay);
  const { month, isLeapMonth } = parseMonthCode(fields.monthCode);
  return { values: { year: fields.year, month, day: fields.day }, isLeapMonth };
};

const pasteDate = ({ context, state }: DateFieldScope, text: string): DateFieldState => {
  const parts = readPastedParts(text, context.locale.field.order);
  if (parts === null) return state;
  return {
    ...state,
    isLeapMonth: false,
    segments: state.segments.map((segment) => withSegmentValue(segment, parts[segment.kind])),
  };
};

// Goal: 붙여넣기는 숫자만 추림. 첫 덩어리가 네 자리면 연-월-일(ISO) 순서로 보고, 아니면 로케일 순서를 따름 (Review Focus 4)
const readPastedParts = (text: string, localeOrder: readonly DateSegmentKind[]): DateParts | null => {
  const digitGroups = text.match(/\d+/g) ?? [];
  const [onlyGroup] = digitGroups;
  if (digitGroups.length === 1 && onlyGroup?.length === COMPACT_DATE_LENGTH) {
    const dayStart = YEAR_DIGITS + MONTH_DIGITS;
    return {
      year: Number(onlyGroup.slice(0, YEAR_DIGITS)),
      month: Number(onlyGroup.slice(YEAR_DIGITS, dayStart)),
      day: Number(onlyGroup.slice(dayStart)),
    };
  }
  if (digitGroups.length !== ISO_ORDER.length) return null;
  const order = digitGroups[0]?.length === YEAR_DIGITS ? ISO_ORDER : localeOrder;
  const partValue = (kind: DateSegmentKind): number => Number(digitGroups[order.indexOf(kind)]);
  return { year: partValue('year'), month: partValue('month'), day: partValue('day') };
};

const switchEntryCalendar = ({ context, state }: DateFieldScope, calendarId: CalendarId): DateFieldState => {
  if (calendarId === state.entryCalendarId) return state;
  const { epochDay } = dateFieldResult(state, context);
  const calendar = findCalendar(context.calendars, calendarId);
  if (epochDay === null || !calendar.fromEpochDay(epochDay).isOk) {
    return { ...state, entryCalendarId: calendarId, isLeapMonth: false };
  }
  const parts = partsOf(calendar, epochDay);
  return {
    ...state,
    entryCalendarId: calendarId,
    isLeapMonth: parts.isLeapMonth,
    segments: state.segments.map((segment) => withSegmentValue(segment, parts.values[segment.kind])),
  };
};

// Goal: 같은 값을 다시 동기화하면 같은 상태를 돌려줘 store 구독자가 다시 그리지 않게 함
const syncValue = ({ context, state }: DateFieldScope, initial: DateFieldInitial): DateFieldState => {
  const synced = createDateFieldState(context, initial);
  const isUnchanged =
    synced.entryCalendarId === state.entryCalendarId &&
    synced.isLeapMonth === state.isLeapMonth &&
    synced.segments.every((segment, index) => segment.value === state.segments[index]?.value);
  return isUnchanged ? state : { ...synced, focusedIndex: state.focusedIndex };
};

// Goal: 월 칸 ↑↓는 그해 실제 달 순서(윤달 포함)를 따라감. 양력도 같은 경로를 써서 역법 종류로 분기하지 않음
const stepDateSegment = (scope: DateFieldScope, amount: number): DateFieldState => {
  const { context, state } = scope;
  const focused = state.focusedIndex === null ? undefined : state.segments[state.focusedIndex];
  const year = state.segments.find((segment) => segment.kind === 'year')?.value ?? null;
  const calendar = findCalendar(context.calendars, state.entryCalendarId);
  const monthCodes = focused?.kind !== 'month' || year === null ? null : monthCodesIfSupported(calendar, year);
  if (!focused || focused.value === null || monthCodes === null) {
    return reduceSegmentEvent<DateSegmentKind, DateFieldState>(state, { type: 'segment.step', amount }, (kind) =>
      todayPart(scope, kind),
    );
  }
  const currentIndex = Math.max(monthCodes.indexOf(toMonthCode(focused.value, state.isLeapMonth)), 0);
  const nextCode = monthCodes[(((currentIndex + amount) % monthCodes.length) + monthCodes.length) % monthCodes.length];
  if (nextCode === undefined) return state;
  const { month, isLeapMonth } = parseMonthCode(nextCode);
  return { ...replaceFocusedSegment(state, withSegmentValue(focused, month)), isLeapMonth };
};

const monthCodesIfSupported = (calendar: CalendarSystem, year: number): readonly MonthCode[] | null => {
  const { firstYear, lastYear } = supportedYearRange(calendar);
  return year < firstYear || year > lastYear ? null : calendar.monthsInYear(year);
};

// Constraint: 오늘이 입력 역법의 지원 범위 밖이어도 빈 칸 ↑↓가 예외 없이 시작하도록 범위 안으로 당김
const todayPart = ({ context, state }: DateFieldScope, kind: DateSegmentKind): number => {
  const calendar = findCalendar(context.calendars, state.entryCalendarId);
  return partsOf(calendar, clampEpochDay(context.today, calendar.supportedRange)).values[kind];
};

const partsFromSegments = (segments: readonly Segment<DateSegmentKind>[]): DateParts => {
  const partValue = (kind: DateSegmentKind): number => segments.find((segment) => segment.kind === kind)?.value ?? 0;
  return { year: partValue('year'), month: partValue('month'), day: partValue('day') };
};
