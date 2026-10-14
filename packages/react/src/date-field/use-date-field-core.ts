import {
  type CalendarId,
  type CalendarSystem,
  gregory,
  LunisolarPickerError,
  toMonthCode,
} from '@lunisolar-picker/calendar';
import {
  createDateFieldState,
  type DateFieldEvent,
  type DateFieldResult,
  type DateFieldState,
  type DateSegmentKind,
  dateFieldReducer,
  dateFieldResult,
  findCalendar,
  type PickerContext,
  type RangeConstraints,
  type Segment,
  type SelectedDay,
  supportedYearRange,
  type Validity,
} from '@lunisolar-picker/core';
import {
  type ButtonHTMLAttributes,
  type FocusEvent,
  type HTMLAttributes,
  type RefCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type SegmentDescription, type SegmentedField, useSegmentedField } from '../segments/use-segmented-field';
import { usePickerContext } from '../settings/use-picker-context';
import type { PickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';

const MONTH_DAY_DIGITS = 2;
const RESET_KEY_SEPARATOR = '|';
const YEAR_DIGITS = 4;

export type DateFieldCoreOptions = DateFieldSegmentsOptions & DateFieldStoreOptions;

export type DateFieldSegmentsOptions = {
  readonly isDisabled: boolean;
  // Goal: 이 칸 묶음을 소유한 쪽이 정한 무효 여부. DateField는 앱의 invalid prop, 범위 필드는 invalid prop과 범위 단위 이유(range-too-long 등)를 넣음
  readonly isInvalidFromOwner: boolean;
  readonly isReadOnly: boolean;
  readonly isRequired: boolean;
  readonly onFocusLeave?: (() => void) | undefined;
  readonly separator: string | undefined;
  readonly settings: PickerSettings;
};

export type DateFieldStore = {
  readonly context: PickerContext;
  readonly entryCalendar: CalendarSystem;
  readonly result: DateFieldResult;
  readonly send: (event: DateFieldEvent) => void;
  readonly state: DateFieldState;
};

export type DateFieldStoreOptions = {
  // Constraint: 범위 필드는 범위 제약(maxDays 등)도 넘김. 컨텍스트가 범위 검증에 쓸 수 있게 해석해 둠
  readonly constraints: RangeConstraints;
  // Constraint: 초기 값이 있으면 무시됨. 값이 있으면 값의 역법이 입력 역법이 됨 (계약 §2.7 ②)
  readonly initialEntryCalendarId: CalendarId;
  readonly initialSelected: SelectedDay | null;
  // Goal: 앱이 제어하는 entryCalendar. 마운트 뒤 바뀔 때만 store로 밀어 넣음
  readonly requestedEntryCalendarId: CalendarId | undefined;
  readonly settings: PickerSettings;
};

export interface DateFieldCore {
  readonly state: DateFieldState;
  readonly context: PickerContext;
  readonly result: DateFieldResult;
  readonly validity: Validity;
  readonly entryCalendar: CalendarSystem;
  readonly separator: string;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly segmentedField: SegmentedField;
  send(event: DateFieldEvent): void;
  getRootProps(): DateFieldRootProps;
  getSeparatorProps(): HTMLAttributes<HTMLSpanElement> & DataAttributeProps;
  getLeapMonthToggleProps(): ButtonHTMLAttributes<HTMLButtonElement> & DataAttributeProps;
}

export type DateFieldRootProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & {
    readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
    readonly ref: RefCallback<HTMLElement>;
  };

type CalendarRemovalInput = {
  readonly context: PickerContext;
  // Constraint: 직전 렌더의 입력 역법. 앱이 calendars에서 뺀 뒤에는 context에 없으므로 여기서만 날짜를 구할 수 있음
  readonly previousEntryCalendar: CalendarSystem;
  readonly state: DateFieldState;
};

type DescribeDateSegmentInput = {
  readonly canToggleLeapMonth: boolean;
  readonly index: number;
  readonly settings: PickerSettings;
  readonly state: DateFieldState;
};

export const useDateFieldCore = (options: DateFieldCoreOptions): DateFieldCore =>
  useDateFieldSegments(useDateFieldStore(options), options);

// Goal: 범위 필드가 양 끝 결과로 범위 무효 여부를 먼저 정한 뒤 칸을 만들 수 있게 store 단계와 칸 단계를 나눔 (한 렌더 지연 없음)
export const useDateFieldSegments = (store: DateFieldStore, options: DateFieldSegmentsOptions): DateFieldCore => {
  const { context, entryCalendar, result, send, state } = store;
  const { settings } = options;
  const isInvalid = isVisiblyInvalid({ invalid: options.isInvalidFromOwner, reasons: result.validity.reasons });
  const separator = options.separator ?? settings.locale.field.separator;
  const isLeapMonthInEnteredYear = hasLeapMonthIn(entryCalendar, {
    year: segmentOf(state, 'year')?.value ?? null,
    monthSegment: segmentOf(state, 'month'),
  });
  // Goal: 그해에 없는 윤달 표시가 남아 있으면 끌 수 있어야 함. 막으면 사용자가 invalid-date에서 빠져나올 수 없음
  const canToggleLeapMonth = isLeapMonthInEnteredYear || state.isLeapMonth;
  const isLeapMonthToggleDisabled = options.isDisabled || options.isReadOnly || !canToggleLeapMonth;

  const segmentedField = useSegmentedField({
    focusedIndex: state.focusedIndex,
    describeSegment: (index) => describeDateSegment({ state, index, settings, canToggleLeapMonth }),
    sendCommand: send,
    segmentPart: 'date-field-segment',
    isDisabled: options.isDisabled,
    isReadOnly: options.isReadOnly,
    isInvalid,
    isRequired: options.isRequired,
  });

  return {
    state,
    context,
    result,
    validity: result.validity,
    entryCalendar,
    separator,
    isInvalid,
    isDisabled: options.isDisabled,
    isReadOnly: options.isReadOnly,
    segmentedField,
    send,
    getRootProps: () => ({
      ref: segmentedField.rootRef,
      role: 'group',
      onBlur: createFocusLeaveListener(options.onFocusLeave),
      ...partAttributes('date-field', {
        invalid: isInvalid,
        disabled: options.isDisabled,
        readonly: options.isReadOnly,
        focused: segmentedField.isFocusWithin,
        calendar: state.entryCalendarId,
      }),
    }),
    getSeparatorProps: () => ({ 'aria-hidden': true, ...partAttributes('date-field-separator') }),
    getLeapMonthToggleProps: () => ({
      type: 'button',
      'aria-pressed': state.isLeapMonth,
      'aria-label': settings.locale.labels.leapMonth,
      disabled: isLeapMonthToggleDisabled,
      onClick: () => send({ type: 'leapMonth.toggle' }),
      ...partAttributes('date-field-leap-toggle', {
        selected: state.isLeapMonth,
        disabled: isLeapMonthToggleDisabled,
      }),
    }),
  };
};

export const useDateFieldStore = (options: DateFieldStoreOptions): DateFieldStore => {
  const { settings, constraints, requestedEntryCalendarId } = options;
  const context = usePickerContext(settings, { constraints, commitMode: 'immediate', numberOfMonths: 1 });
  const previousEntryCalendarRef = useRef<CalendarSystem>(gregory);
  // Constraint: 로케일(칸 순서)이나 역법 구성이 바뀌면 이전 상태로 store를 다시 만듦. 역법 구성이 바뀐 렌더 안에서 바로 고쳐야 빠진 역법을 찾다가 렌더가 던지지 않음
  const { state, send } = useStoreInstance(
    (previous: DateFieldState | undefined) =>
      previous === undefined
        ? createDateFieldState(context, {
            selected: options.initialSelected,
            entryCalendarId: options.initialEntryCalendarId,
          })
        : moveOffRemovedCalendar({
            context,
            previousEntryCalendar: previousEntryCalendarRef.current,
            state: reorderForLocale(previous, context),
          }),
    dateFieldReducer,
    context,
    { resetKey: [settings.locale.id, settings.calendarKey].join(RESET_KEY_SEPARATOR) },
  );

  // Constraint: 마운트 때 값의 역법과 entryCalendar가 달라도 값의 역법을 유지함. prop이 실제로 바뀔 때만 밀어 넣어야 마운트에서 값이 바뀌고 onValueChange가 불리지 않음
  const lastRequestedEntryCalendarIdRef = useRef(requestedEntryCalendarId);
  useEffect(() => {
    if (
      requestedEntryCalendarId === undefined ||
      requestedEntryCalendarId === lastRequestedEntryCalendarIdRef.current
    ) {
      return;
    }
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastRequestedEntryCalendarIdRef.current = requestedEntryCalendarId;
    send({ type: 'calendar.set', calendarId: requestedEntryCalendarId });
  }, [requestedEntryCalendarId, send]);

  // Goal: 입력 역법의 단일 출처는 store. 값 문자열·윤달 판단·data-calendar가 모두 같은 역법을 봄
  const entryCalendar = findCalendar(settings.calendars, state.entryCalendarId);
  useLayoutEffect(() => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    previousEntryCalendarRef.current = entryCalendar;
  });
  const result = useMemo(() => dateFieldResult(state, context), [state, context]);
  return { context, entryCalendar, result, send, state };
};

const describeDateSegment = ({
  canToggleLeapMonth,
  index,
  settings,
  state,
}: DescribeDateSegmentInput): SegmentDescription => {
  const segment = state.segments[index];
  if (segment === undefined) {
    throw new LunisolarPickerError(`DateField.Segment index ${index} is out of range (0-${state.segments.length - 1})`);
  }
  const { locale } = settings;
  const leapPrefix = segment.kind === 'month' && state.isLeapMonth ? locale.field.leapMonthPrefix : '';
  const digits = segment.kind === 'year' ? YEAR_DIGITS : MONTH_DAY_DIGITS;
  const valueDisplay = segment.value === null ? null : `${leapPrefix}${String(segment.value).padStart(digits, '0')}`;
  const placeholder = locale.field.placeholder[segment.kind];
  return {
    label: locale.labels[segment.kind],
    displayText: segment.typedText !== '' ? `${leapPrefix}${segment.typedText}` : (valueDisplay ?? placeholder),
    valueText: valueDisplay ?? placeholder,
    isPlaceholder: segment.value === null && segment.typedText === '',
    minValue: segment.minValue,
    maxValue: segment.maxValue,
    value: segment.value,
    // Goal: L 키는 필드 전체 단축키. 월을 치면 포커스가 일 칸으로 넘어가므로 월 칸에서만 받으면 윤달을 켤 수 없음 (preflight 2.5)
    canToggleLeapMonth,
  };
};

// Constraint: 윤달 여부는 역법 id가 아니라 그해 실제 달 목록에서 판정함 (계약 §2.7 ⑧). 월 범위는 칸 한계를 단일 출처로 씀
const hasLeapMonthIn = (
  calendar: CalendarSystem,
  { year, monthSegment }: { readonly year: number | null; readonly monthSegment: Segment<DateSegmentKind> | undefined },
): boolean => {
  const month = monthSegment?.value ?? null;
  if (year === null || monthSegment === undefined || month === null) return false;
  const isMonthInRange = Number.isInteger(month) && month >= monthSegment.minValue && month <= monthSegment.maxValue;
  const { firstYear, lastYear } = supportedYearRange(calendar);
  const isYearSupported = year >= firstYear && year <= lastYear;
  return isMonthInRange && isYearSupported && calendar.monthsInYear(year).includes(toMonthCode(month, true));
};

// Goal: 앱이 calendars에서 지금 입력 역법을 빼면 양력으로 돌아감. 직전 입력 역법으로 구한 같은 날을 양력으로 다시 적음 (입력 역법을 바꿀 때와 같은 규칙)
// Constraint: 직전 역법이 상태의 역법과 다르면(같은 렌더 안에서 역법이 두 번 바뀐 경우) 날짜를 구할 수 없어 비움
const moveOffRemovedCalendar = ({ context, previousEntryCalendar, state }: CalendarRemovalInput): DateFieldState => {
  const isProvided = context.calendars.some((calendar) => calendar.id === state.entryCalendarId);
  if (isProvided) return state;
  const canReadPreviousDay = previousEntryCalendar.id === state.entryCalendarId;
  const { epochDay } = canReadPreviousDay
    ? dateFieldResult(state, { ...context, calendars: [...context.calendars, previousEntryCalendar] })
    : { epochDay: null };
  const moved = createDateFieldState(context, {
    selected: epochDay === null ? null : { epochDay, calendarId: gregory.id },
    entryCalendarId: gregory.id,
  });
  return { ...moved, focusedIndex: state.focusedIndex };
};

// Goal: 로케일이 바뀌면 칸 순서만 새 로케일로 바꾸고 입력 중인 숫자·윤달·역법은 그대로 둠. 확정 값이 같아 onValueChange가 다시 불리지 않음 (preflight 3.5)
const reorderForLocale = (previous: DateFieldState, context: PickerContext): DateFieldState => {
  const reordered = context.locale.field.order.flatMap((kind) =>
    previous.segments.filter((segment) => segment.kind === kind),
  );
  const focusedKind = previous.focusedIndex === null ? undefined : previous.segments[previous.focusedIndex]?.kind;
  const focusedIndex = reordered.findIndex((segment) => segment.kind === focusedKind);
  return { ...previous, segments: reordered, focusedIndex: focusedIndex < 0 ? null : focusedIndex };
};

const segmentOf = (state: DateFieldState, kind: DateSegmentKind): Segment<DateSegmentKind> | undefined =>
  state.segments.find((segment) => segment.kind === kind);
