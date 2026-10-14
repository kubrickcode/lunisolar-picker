import {
  type CalendarId,
  type CalendarSystem,
  type EpochDay,
  LunisolarPickerError,
  toMonthCode,
} from '@lunisolar-picker/calendar';
import {
  createDateFieldState,
  type DateConstraints,
  type DateFieldEvent,
  type DateFieldResult,
  type DateFieldState,
  type DateSegmentKind,
  dateFieldReducer,
  dateFieldResult,
  findCalendar,
  type PickerContext,
} from '@lunisolar-picker/core';
import {
  type ButtonHTMLAttributes,
  type FocusEvent,
  type HTMLAttributes,
  type RefCallback,
  useEffect,
  useMemo,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type SegmentDescription, type SegmentedField, useSegmentedField } from '../segments/use-segmented-field';
import { usePickerContext } from '../settings/use-picker-context';
import type { PickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { createFocusLeaveListener } from '../utilities/focus-leave';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;
const MONTH_DAY_DIGITS = 2;
const YEAR_DIGITS = 4;

export type DateFieldCoreOptions = {
  readonly constraints: DateConstraints;
  readonly entryCalendarId: CalendarId;
  readonly initialEpochDay: EpochDay | null;
  readonly isDisabled: boolean;
  readonly isInvalidFromApp: boolean;
  readonly isReadOnly: boolean;
  readonly isRequired: boolean;
  readonly onFocusLeave?: (() => void) | undefined;
  readonly separator: string | undefined;
  readonly settings: PickerSettings;
};

export interface DateFieldCore {
  readonly state: DateFieldState;
  readonly context: PickerContext;
  readonly result: DateFieldResult;
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
  isLeapMonthAvailable(): boolean;
}

export type DateFieldRootProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & {
    readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
    readonly ref: RefCallback<HTMLElement>;
  };

type DescribeDateSegmentInput = {
  readonly canToggleLeapMonth: boolean;
  readonly index: number;
  readonly settings: PickerSettings;
  readonly state: DateFieldState;
};

export const useDateFieldCore = (options: DateFieldCoreOptions): DateFieldCore => {
  const { settings, constraints, entryCalendarId } = options;
  const context = usePickerContext(settings, { constraints, commitMode: 'immediate', numberOfMonths: 1 });
  const { state, send } = useStoreInstance(
    (previous: DateFieldState | undefined) =>
      previous === undefined
        ? createDateFieldState(context, {
            selected:
              options.initialEpochDay === null
                ? null
                : { epochDay: options.initialEpochDay, calendarId: entryCalendarId },
            entryCalendarId,
          })
        : reorderForLocale(previous, context),
    dateFieldReducer,
    context,
    { resetKey: settings.locale.id },
  );

  useEffect(() => {
    if (state.entryCalendarId !== entryCalendarId) send({ type: 'calendar.set', calendarId: entryCalendarId });
  }, [entryCalendarId, state.entryCalendarId, send]);

  // Goal: 값 문자열과 윤달 판단은 store의 입력 역법을 따름. 부모가 다른 역법 값을 넣은 렌더에서 React 쪽 역법이 한 박자 늦어도 값이 바뀐 것처럼 보이지 않게 함 (preflight 3.1)
  const entryCalendar = findCalendar(settings.calendars, state.entryCalendarId);
  const result = useMemo(() => dateFieldResult(state, context), [state, context]);
  const isInvalid =
    options.isInvalidFromApp || (!result.validity.isValid && !result.validity.reasons.includes('incomplete'));
  const separator = options.separator ?? settings.locale.field.separator;
  const isLeapMonthInEnteredYear = hasLeapMonthIn(entryCalendar, {
    year: segmentValueOf(state, 'year'),
    month: segmentValueOf(state, 'month'),
  });
  // Goal: 그해에 없는 윤달 표시가 남아 있으면 끌 수 있어야 함. 막으면 사용자가 invalid-date에서 빠져나올 수 없음
  const canToggleLeapMonth = isLeapMonthInEnteredYear || state.isLeapMonth;

  const segmentedField = useSegmentedField({
    segmentCount: state.segments.length,
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
    entryCalendar,
    separator,
    isInvalid,
    isDisabled: options.isDisabled,
    isReadOnly: options.isReadOnly,
    segmentedField,
    send,
    isLeapMonthAvailable: () => isLeapMonthInEnteredYear,
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
      disabled: options.isDisabled || options.isReadOnly || !canToggleLeapMonth,
      onClick: () => send({ type: 'leapMonth.toggle' }),
      ...partAttributes('date-field-leap-toggle', { selected: state.isLeapMonth }),
    }),
  };
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

// Constraint: 윤달 여부는 역법 id가 아니라 그해 실제 달 목록에서 판정함 (계약 §2.7 ⑧)
const hasLeapMonthIn = (
  calendar: CalendarSystem,
  { year, month }: { readonly year: number | null; readonly month: number | null },
): boolean => {
  if (year === null || month === null || !Number.isInteger(month) || month < FIRST_MONTH || month > LAST_MONTH) {
    return false;
  }
  const isYearSupported = calendar.toEpochDay({ year, monthCode: toMonthCode(FIRST_MONTH, false), day: 1 }).isOk;
  return isYearSupported && calendar.monthsInYear(year).includes(toMonthCode(month, true));
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

const segmentValueOf = (state: DateFieldState, kind: DateSegmentKind): number | null =>
  state.segments.find((segment) => segment.kind === kind)?.value ?? null;
