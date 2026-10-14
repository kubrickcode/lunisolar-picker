import {
  type CalendarId,
  type CalendarSystem,
  type DateFields,
  type EpochDay,
  type MonthCode,
  parseMonthCode,
  toMonthCode,
} from '@lunisolar-picker/calendar';
import { validateEpochDay } from '../constraints/validate';
import { findCalendar, type PickerContext } from '../context';
import type { Reducer } from '../create-store';
import { clampEpochDay, fieldsOf, supportedYearRange } from '../grid/calendar-math';
import type { LocaleData } from '../locales/locale-data';
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
  wrapStep,
} from './segment';
import type { SelectedDay } from './selectable';

const COMPACT_DATE_LENGTH = 8;
const DIGIT_GROUP_PATTERN = /\d+/g;
const ISO_ORDER: readonly DateSegmentKind[] = ['year', 'month', 'day'];
// Constraint: 윤달이 없는 역법(양력)은 지원 연도 전체를 훑어야 판정되므로 역법마다 한 번만 계산해 둠 (성능상 예외적 가변 캐시)
const LEAP_MONTH_SUPPORT_CACHE: WeakMap<CalendarSystem, boolean> = /* @__PURE__ */ new WeakMap();
const MONTH_EDIT_EVENT_TYPES: ReadonlySet<DateFieldEvent['type']> = new Set([
  'digit.type',
  'segment.erase',
  'segment.step',
]);
const SEGMENT_LIMITS: Readonly<Record<DateSegmentKind, SegmentLimits>> = {
  year: { minValue: 1, maxValue: 9999, maxDigits: 4 },
  month: { minValue: 1, maxValue: 12, maxDigits: 2 },
  // Constraint: 달 길이는 연·월이 다 들어와야 알 수 있어 입력 중에는 31까지 받고, 결과에서 역법이 판정함 (스펙 5.4)
  day: { minValue: 1, maxValue: 31, maxDigits: 2 },
};

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

type DigitGroup = {
  readonly digits: string;
  readonly start: number;
};

type NumberedMonth = {
  readonly isLeapMonth: boolean;
  readonly month: number;
};

type PastedDateInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly locale: LocaleData;
  readonly text: string;
};

type StaleLeapFlagInput = {
  readonly edited: DateFieldState;
  readonly event: DateFieldEvent;
  readonly scope: DateFieldScope;
};

type StepMonthInput = {
  readonly amount: number;
  readonly focused: Segment<DateSegmentKind>;
  readonly scope: DateFieldScope;
};

type StepRange = Pick<SegmentLimits, 'maxValue' | 'minValue'>;

export const createDateFieldState = (context: PickerContext, initial: DateFieldInitial): DateFieldState => {
  const calendarId = initial.selected?.calendarId ?? initial.entryCalendarId;
  // Constraint: 입력 역법으로 적을 수 없는 날(value.sync·초기값으로 들어온 범위 밖 값)은 singleValue·rangeValue처럼 값 없음으로 둠
  const parts =
    initial.selected === null
      ? null
      : representablePartsOf(findCalendar(context.calendars, calendarId), initial.selected.epochDay);
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
  const scope: DateFieldScope = { context, state };
  switch (event.type) {
    case 'text.paste':
      return pasteDate(scope, event.text);
    case 'leapMonth.toggle':
      return hasLeapMonths(entryCalendarOf(scope)) ? { ...state, isLeapMonth: !state.isLeapMonth } : state;
    case 'calendar.set':
      return switchEntryCalendar(scope, event.calendarId);
    case 'value.sync':
      return syncValue(scope, event);
    case 'segment.step':
      return clearStaleLeapFlag({ edited: stepDateSegment(scope, event.amount), event, scope });
    default:
      return clearStaleLeapFlag({
        edited: reduceSegmentEvent<DateSegmentKind, DateFieldState>(state, event, (kind) => todayPart(scope, kind)),
        event,
        scope,
      });
  }
};

export const dateFieldResult = (state: DateFieldState, context: PickerContext): DateFieldResult => {
  const values = state.segments.map((segment) => segment.value);
  if (values.every((value) => value === null)) return { epochDay: null, validity: VALID };
  if (values.some((value) => value === null)) return { epochDay: null, validity: invalidBecause(['incomplete']) };
  const parts = partsFromSegments(state.segments);
  if (!isMonthNumber(parts.month) || parts.year < 1 || parts.day < 1) {
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

// Constraint: 윤달 지원 여부는 역법 id가 아니라 역법 데이터로 판정함 (스펙 3.2 — core는 역법 종류로 분기하지 않음)
export const hasLeapMonths = (calendar: CalendarSystem): boolean => {
  const cached = LEAP_MONTH_SUPPORT_CACHE.get(calendar);
  if (cached !== undefined) return cached;
  const { firstYear, lastYear } = supportedYearRange(calendar);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const hasLeap = years.some((year) =>
    calendar.monthsInYear(year).some((monthCode) => parseMonthCode(monthCode).isLeapMonth),
  );
  LEAP_MONTH_SUPPORT_CACHE.set(calendar, hasLeap);
  return hasLeap;
};

// Goal: 윤달이 없는 역법에서 붙여넣기로 남은 윤달 표시는 월 칸을 고치면 풀림. 토글이 막혀 있어도 유효한 날짜로 돌아올 수 있게 함
const clearStaleLeapFlag = ({ edited, event, scope }: StaleLeapFlagInput): DateFieldState => {
  const focused = focusedSegmentOf(scope.state);
  const isStale =
    edited.isLeapMonth &&
    focused?.kind === 'month' &&
    MONTH_EDIT_EVENT_TYPES.has(event.type) &&
    !hasLeapMonths(entryCalendarOf(scope));
  return isStale ? { ...edited, isLeapMonth: false } : edited;
};

const focusedSegmentOf = (state: DateFieldState): Segment<DateSegmentKind> | undefined =>
  state.focusedIndex === null ? undefined : state.segments[state.focusedIndex];

const entryCalendarOf = ({ context, state }: DateFieldScope): CalendarSystem =>
  findCalendar(context.calendars, state.entryCalendarId);

const partsOfFields = (fields: DateFields): DatePartsOfDay => {
  const { month, isLeapMonth } = parseMonthCode(fields.monthCode);
  return { values: { year: fields.year, month, day: fields.day }, isLeapMonth };
};

const representablePartsOf = (calendar: CalendarSystem, epochDay: EpochDay): DatePartsOfDay | null => {
  const fields = calendar.fromEpochDay(epochDay);
  return fields.isOk ? partsOfFields(fields.value) : null;
};

const pasteDate = ({ context, state }: DateFieldScope, text: string): DateFieldState => {
  const pasted = readPastedDate({ calendars: context.calendars, locale: context.locale, text });
  if (pasted === null) return state;
  return {
    ...state,
    isLeapMonth: pasted.isLeapMonth,
    segments: state.segments.map((segment) => withSegmentValue(segment, pasted.values[segment.kind])),
  };
};

// Goal: 붙여넣기는 숫자 덩어리만 추림. 한 덩어리면 로케일 칸 순서의 자릿수대로 자르고, 세 덩어리면 첫 덩어리가 네 자리일 때 연-월-일(ISO), 아니면 로케일 순서 (Review Focus 4)
const readPastedDate = ({ calendars, locale, text }: PastedDateInput): DatePartsOfDay | null => {
  const digitGroups: readonly DigitGroup[] = [...text.matchAll(DIGIT_GROUP_PATTERN)].map((match) => ({
    digits: match[0],
    start: match.index,
  }));
  const [onlyGroup] = digitGroups;
  if (digitGroups.length === 1 && onlyGroup?.digits.length === COMPACT_DATE_LENGTH) {
    return { isLeapMonth: false, values: sliceCompactDate(onlyGroup.digits, locale.field.order) };
  }
  if (digitGroups.length !== ISO_ORDER.length) return null;
  const order = digitGroups[0]?.digits.length === SEGMENT_LIMITS.year.maxDigits ? ISO_ORDER : locale.field.order;
  const partValue = (kind: DateSegmentKind): number => Number(digitGroups[order.indexOf(kind)]?.digits);
  const values: DateParts = { year: partValue('year'), month: partValue('month'), day: partValue('day') };
  const monthIndex = order.indexOf('month');
  const previousGroup = digitGroups[monthIndex - 1];
  const textBeforeMonth = text.slice(
    previousGroup === undefined ? 0 : previousGroup.start + previousGroup.digits.length,
    digitGroups[monthIndex]?.start,
  );
  // Constraint: 윤달이 없는 역법이어도 표시를 버리지 않음. 버리면 음력 글이 다른 양력 날짜로 조용히 바뀜 → 결과가 invalid-date로 알림
  const isLeapMonth = hasLeapMarker({ calendars, locale, text: textBeforeMonth });
  return { isLeapMonth, values };
};

const sliceCompactDate = (digits: string, order: readonly DateSegmentKind[]): DateParts => {
  const startOf = (kind: DateSegmentKind): number =>
    order.slice(0, order.indexOf(kind)).reduce((sum, previous) => sum + SEGMENT_LIMITS[previous].maxDigits, 0);
  const partValue = (kind: DateSegmentKind): number =>
    Number(digits.slice(startOf(kind), startOf(kind) + SEGMENT_LIMITS[kind].maxDigits));
  return { year: partValue('year'), month: partValue('month'), day: partValue('day') };
};

// Goal: 필드가 윤달을 적는 접두어(윤·閏·L)와, 설정된 윤달 역법의 달 이름 윤달 표기(en "Leap 5")를 모두 윤달 표시로 읽음. 입력 역법이 양력이어도 음력 글을 알아봄
const hasLeapMarker = ({ calendars, locale, text }: PastedDateInput): boolean => {
  const nameMarkers = calendars
    .filter((calendar) => hasLeapMonths(calendar))
    .map((calendar) => leapMonthNameMarker(locale, calendar.id));
  const markers = [locale.field.leapMonthPrefix, ...nameMarkers].filter((marker) => marker !== '');
  const trimmed = text.trimEnd();
  return markers.some((marker) => trimmed.endsWith(marker));
};

const leapMonthNameMarker = (locale: LocaleData, calendarId: CalendarId): string => {
  const leapMonthName = locale.formatMonthName({ year: 1, monthCode: toMonthCode(1, true) }, calendarId);
  const firstDigitIndex = leapMonthName.search(/\d/);
  return firstDigitIndex < 0 ? '' : leapMonthName.slice(0, firstDigitIndex).trim();
};

const switchEntryCalendar = ({ context, state }: DateFieldScope, calendarId: CalendarId): DateFieldState => {
  if (calendarId === state.entryCalendarId) return state;
  const { epochDay } = dateFieldResult(state, context);
  const parts = epochDay === null ? null : representablePartsOf(findCalendar(context.calendars, calendarId), epochDay);
  if (parts === null) return { ...state, entryCalendarId: calendarId, isLeapMonth: false };
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

// Goal: 월 칸 ↑↓는 그해 실제 달 순서(윤달 포함)를 따라가고, 연·일 칸은 입력 역법이 아는 범위 안에서 돎. 양력도 같은 경로를 써서 역법 종류로 분기하지 않음
const stepDateSegment = (scope: DateFieldScope, amount: number): DateFieldState => {
  const focused = focusedSegmentOf(scope.state);
  if (focused === undefined || focused.value === null) return stepFromToday(scope, amount);
  if (focused.kind === 'month') return stepMonth({ amount, focused, scope });
  const range = focused.kind === 'year' ? supportedYearStepRange(scope) : dayStepRange(scope);
  if (range === null) return stepFromToday(scope, amount);
  // Goal: 2월에 남은 31일이나 범위 밖 연도는 가까운 끝에서 출발해야 ↑↓ 한 번의 결과가 예측 가능함
  const start = Math.min(Math.max(focused.value, range.minValue), range.maxValue);
  return replaceFocusedSegment(scope.state, withSegmentValue(focused, wrapStep({ amount, ...range, value: start })));
};

const stepFromToday = (scope: DateFieldScope, amount: number): DateFieldState =>
  reduceSegmentEvent<DateSegmentKind, DateFieldState>(scope.state, { type: 'segment.step', amount }, (kind) =>
    todayPart(scope, kind),
  );

const stepMonth = ({ amount, focused, scope }: StepMonthInput): DateFieldState => {
  const { state } = scope;
  const year = segmentValueOf(state, 'year');
  const monthCodes = year === null ? null : monthCodesIfSupported(entryCalendarOf(scope), year);
  if (focused.value === null || !isMonthNumber(focused.value) || monthCodes === null) {
    return stepFromToday(scope, amount);
  }
  const currentIndex = currentMonthIndex(monthCodes, { isLeapMonth: state.isLeapMonth, month: focused.value });
  const nextCode = monthCodes[(((currentIndex + amount) % monthCodes.length) + monthCodes.length) % monthCodes.length];
  if (nextCode === undefined) return state;
  const { month, isLeapMonth } = parseMonthCode(nextCode);
  return { ...replaceFocusedSegment(state, withSegmentValue(focused, month)), isLeapMonth };
};

const segmentValueOf = (state: DateFieldState, kind: DateSegmentKind): number | null =>
  state.segments.find((segment) => segment.kind === kind)?.value ?? null;

const supportedYearStepRange = (scope: DateFieldScope): StepRange => {
  const { firstYear, lastYear } = supportedYearRange(entryCalendarOf(scope));
  return { minValue: firstYear, maxValue: lastYear };
};

// Constraint: 달 길이는 연·월을 다 알아야 정해지므로 하나라도 모르면 null → 칸 기본 범위(1~31)로 돎
const dayStepRange = (scope: DateFieldScope): StepRange | null => {
  const { state } = scope;
  const calendar = entryCalendarOf(scope);
  const year = segmentValueOf(state, 'year');
  const month = segmentValueOf(state, 'month');
  const monthCodes = year === null ? null : monthCodesIfSupported(calendar, year);
  if (year === null || month === null || !isMonthNumber(month) || monthCodes === null) return null;
  const monthCode = existingMonthCode(monthCodes, { isLeapMonth: state.isLeapMonth, month });
  return monthCode === null ? null : { minValue: 1, maxValue: calendar.daysInMonth(year, monthCode) };
};

// Goal: 그해에 없는 윤달 표시가 남아 있어도 1월로 튀지 않고 같은 번호의 평달 자리에서 이어감
const currentMonthIndex = (monthCodes: readonly MonthCode[], input: NumberedMonth): number => {
  const monthCode = existingMonthCode(monthCodes, input);
  return monthCode === null ? 0 : monthCodes.indexOf(monthCode);
};

const existingMonthCode = (
  monthCodes: readonly MonthCode[],
  { isLeapMonth, month }: NumberedMonth,
): MonthCode | null => {
  const exactCode = toMonthCode(month, isLeapMonth);
  if (monthCodes.includes(exactCode)) return exactCode;
  const regularCode = toMonthCode(month, false);
  return monthCodes.includes(regularCode) ? regularCode : null;
};

const isMonthNumber = (value: number): boolean =>
  Number.isInteger(value) && value >= SEGMENT_LIMITS.month.minValue && value <= SEGMENT_LIMITS.month.maxValue;

const monthCodesIfSupported = (calendar: CalendarSystem, year: number): readonly MonthCode[] | null => {
  const { firstYear, lastYear } = supportedYearRange(calendar);
  return year < firstYear || year > lastYear ? null : calendar.monthsInYear(year);
};

// Constraint: 오늘이 입력 역법의 지원 범위 밖이어도 빈 칸 ↑↓가 예외 없이 시작하도록 범위 안으로 당김
const todayPart = (scope: DateFieldScope, kind: DateSegmentKind): number => {
  const calendar = entryCalendarOf(scope);
  return partsOfFields(fieldsOf(calendar, clampEpochDay(scope.context.today, calendar.supportedRange))).values[kind];
};

const partsFromSegments = (segments: readonly Segment<DateSegmentKind>[]): DateParts => {
  const partValue = (kind: DateSegmentKind): number => segments.find((segment) => segment.kind === kind)?.value ?? 0;
  return { year: partValue('year'), month: partValue('month'), day: partValue('day') };
};
