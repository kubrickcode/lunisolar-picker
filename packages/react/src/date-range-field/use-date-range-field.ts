import {
  type CalendarId,
  type CalendarSystem,
  calendarIdOf,
  type DateRangeValue,
  type DateString,
  type EpochDay,
  epochDayOf,
  gregory,
  isSameRange,
  normalizeDateRange,
  type ValidationReason,
} from '@lunisolar-picker/calendar';
import {
  type DateFieldResult,
  type DateSegmentKind,
  invalidBecause,
  type RangeConstraints,
  type ResolvedConstraints,
  type Segment,
  type SelectedDay,
  VALID,
  type Validity,
  validateEpochRange,
} from '@lunisolar-picker/core';
import { type FocusEvent, type HTMLAttributes, useLayoutEffect, useMemo, useState } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type DateFieldCore, useDateFieldCore } from '../date-field/use-date-field-core';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { type DateRangeInput, parseOptionalRange } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

const CALENDAR_KEY_SEPARATOR = ',';
const INCOMPLETE_REASON: ValidationReason = 'incomplete';

type CombineRangeInput = {
  readonly calendar: CalendarSystem;
  readonly endEpochDay: EpochDay | null;
  readonly isOpenEndAllowed: boolean;
  readonly startEpochDay: EpochDay | null;
};

export interface DateRangeFieldApi {
  readonly start: DateFieldCore;
  readonly end: DateFieldCore;
  readonly value: DateRangeValue | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly entryCalendarId: CalendarId;
  setEntryCalendar(calendarId: CalendarId): void;
  focus(): void;
  getRootProps(): HTMLAttributes<HTMLDivElement> &
    DataAttributeProps & { readonly onBlur: (event: FocusEvent<HTMLElement>) => void };
  getRangeSeparatorProps(): HTMLAttributes<HTMLSpanElement> & DataAttributeProps;
  getHiddenInputProps(side: RangeSide): HiddenInputProps;
}

export type RangeSide = 'start' | 'end';

type RangeValidityInput = {
  readonly constraints: ResolvedConstraints;
  readonly endResult: DateFieldResult;
  readonly startResult: DateFieldResult;
  readonly value: DateRangeValue | null;
};

export interface UseDateRangeFieldProps extends SharedPickerProps, RangeConstraints {
  readonly value?: DateRangeInput | null | undefined;
  readonly defaultValue?: DateRangeInput | null | undefined;
  readonly onValueChange?: ((value: DateRangeValue | null, details: ValueChangeDetails) => void) | undefined;
  readonly entryCalendar?: CalendarId | undefined;
  readonly defaultEntryCalendar?: CalendarId | undefined;
  readonly onEntryCalendarChange?: ((calendarId: CalendarId) => void) | undefined;
  readonly separator?: string | undefined;
  readonly startName?: string | undefined;
  readonly endName?: string | undefined;
}

export const useDateRangeField = (props: UseDateRangeFieldProps): DateRangeFieldApi => {
  const settings = usePickerSettings(props);
  const calendarKey = settings.calendars.map((calendar) => calendar.id).join(CALENDAR_KEY_SEPARATOR);
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalRange(input, settings.calendars),
    describeRangeInput,
    props.onInvalidValue,
    calendarKey,
  );
  const [initialValue] = useState(
    () => controlled.value ?? parseOptionalRange(props.defaultValue, settings.calendars).value,
  );
  // Constraint: 값이 있으면 start의 역법이 양 끝의 입력 역법이 됨. 끝이 비어 있는(열린) 범위의 end도 같은 역법으로 시작해야 함 (계약 §3.3)
  const initialEntryCalendarId =
    initialValue === null
      ? (props.entryCalendar ?? props.defaultEntryCalendar ?? gregory.id)
      : calendarIdOf(initialValue.start);
  const sharedCoreOptions = {
    settings,
    constraints: props,
    initialEntryCalendarId,
    requestedEntryCalendarId: props.entryCalendar,
    separator: props.separator,
    isDisabled: props.disabled === true,
    isReadOnly: props.readOnly === true,
    isRequired: props.required === true,
    isInvalidFromApp: props.invalid === true,
  };
  const start = useDateFieldCore({
    ...sharedCoreOptions,
    initialSelected: selectedDayOf(initialValue?.start ?? null),
  });
  const end = useDateFieldCore({
    ...sharedCoreOptions,
    initialSelected: selectedDayOf(initialValue?.end ?? null),
  });
  const isOpenEndAllowed = props.isOpenEndAllowed === true;

  // Goal: 입력 역법의 단일 출처는 store. 양 끝 store는 같은 역법으로만 바뀌므로 start 쪽 역법으로 둘 다 표기함
  const value = useMemo(
    () =>
      combineRange({
        startEpochDay: start.result.epochDay,
        endEpochDay: end.result.epochDay,
        calendar: start.entryCalendar,
        isOpenEndAllowed,
      }),
    [start.result.epochDay, end.result.epochDay, start.entryCalendar, isOpenEndAllowed],
  );
  const constraints = start.context.constraints;
  const validity = useMemo(
    () => rangeValidity({ value, startResult: start.result, endResult: end.result, constraints }),
    [value, start.result, end.result, constraints],
  );
  const isInvalid = props.invalid === true || (!validity.isValid && !validity.reasons.includes(INCOMPLETE_REASON));

  useMoveToEndWhenStartCompletes(start, end);

  // Constraint: 부모가 다른 역법으로 적힌 범위를 주면 양 끝 store의 입력 역법도 그 역법이 됨(값의 역법 우선). 부모가 한 일이라 onEntryCalendarChange는 부르지 않음
  useValueBridge<DateRangeValue>({
    committedValue: value,
    controlled,
    isEqual: isSameRange,
    syncStore: (next) => {
      const entryCalendarId = next === null ? start.state.entryCalendarId : calendarIdOf(next.start);
      start.send({ type: 'value.sync', selected: selectedDayOf(next?.start ?? null), entryCalendarId });
      end.send({ type: 'value.sync', selected: selectedDayOf(next?.end ?? null), entryCalendarId });
    },
    onValueChange: (next) => props.onValueChange?.(next, { validity }),
  });

  const focus = (): void => start.segmentedField.focusSegment(0);
  // Constraint: DateField와 같은 정책. 사용자가 바꾼 역법은 부모가 제어해도 바로 반영하고 알림
  const setEntryCalendar = (calendarId: CalendarId): void => {
    if (calendarId === start.state.entryCalendarId) return;
    start.send({ type: 'calendar.set', calendarId });
    end.send({ type: 'calendar.set', calendarId });
    props.onEntryCalendarChange?.(calendarId);
  };
  const sideCores: Readonly<Record<RangeSide, DateFieldCore>> = { start, end };

  return {
    start,
    end,
    value,
    validity,
    isInvalid,
    entryCalendarId: start.state.entryCalendarId,
    setEntryCalendar,
    focus,
    getRootProps: () => ({
      role: 'group',
      // Constraint: 시작·종료 칸 사이 이동은 필드 안이므로 그룹 전체를 벗어날 때만 알림
      onBlur: createFocusLeaveListener(props.onBlur),
      ...partAttributes('date-range-field', {
        invalid: isInvalid,
        disabled: props.disabled === true,
        readonly: props.readOnly === true,
        calendar: start.state.entryCalendarId,
      }),
    }),
    getRangeSeparatorProps: () => ({ 'aria-hidden': true, ...partAttributes('date-field-separator') }),
    getHiddenInputProps: (side) => ({
      name: side === 'start' ? props.startName : props.endName,
      form: props.form,
      value: (side === 'start' ? value?.start : value?.end) ?? '',
      // Constraint: 열린 범위가 허용되면 종료일 없이도 제출할 수 있어야 함
      required: props.required === true && (side === 'start' || !isOpenEndAllowed),
      disabled: props.disabled,
      onFocusRequest: () => sideCores[side].segmentedField.focusSegment(0),
    }),
  };
};

const describeRangeInput = (input: DateRangeInput): string => `${input.start}/${input.end ?? ''}`;

const selectedDayOf = (date: DateString | null): SelectedDay | null =>
  date === null ? null : { epochDay: epochDayOf(date), calendarId: calendarIdOf(date) };

const combineRange = ({
  calendar,
  endEpochDay,
  isOpenEndAllowed,
  startEpochDay,
}: CombineRangeInput): DateRangeValue | null => {
  const startValue = formatOrNull(startEpochDay, calendar);
  if (startValue === null) return null;
  const endValue = formatOrNull(endEpochDay, calendar);
  if (endValue === null && !isOpenEndAllowed) return null;
  const normalized = normalizeDateRange(startValue, endValue);
  return normalized.isOk ? normalized.value : null;
};

// Goal: 빈 범위는 유효(빨간 테두리 없음). 반만 친 범위는 'incomplete'를 알리되 isInvalid에서는 빠짐 (preflight 2.8)
const rangeValidity = ({ constraints, endResult, startResult, value }: RangeValidityInput): Validity => {
  const fieldReasons = [...startResult.validity.reasons, ...endResult.validity.reasons];
  if (value !== null) {
    const epochRange = { start: epochDayOf(value.start), end: value.end === null ? null : epochDayOf(value.end) };
    return invalidBecause([...fieldReasons, ...validateEpochRange(epochRange, constraints).reasons]);
  }
  if (fieldReasons.length > 0) return invalidBecause(fieldReasons);
  // Constraint: 칸이 모두 비어 있을 때만 core 결과가 epochDay null이면서 유효함
  const isEmpty = startResult.epochDay === null && endResult.epochDay === null;
  return isEmpty ? VALID : invalidBecause([INCOMPLETE_REASON]);
};

// Goal: 시작일의 마지막 칸이 더 받을 숫자가 없을 때 종료일 첫 칸으로 넘어감. 날짜가 이미 성립해도 마지막 칸에 숫자가 더 들어올 수 있으면 기다림 (preflight 2.7)
// Constraint: layout effect로 옮겨야 다음 키 입력이 시작일 칸에 들어가지 않음
const useMoveToEndWhenStartCompletes = (start: DateFieldCore, end: DateFieldCore): void => {
  const lastIndex = start.state.segments.length - 1;
  const lastSegment = start.state.segments[lastIndex];
  const isStartComplete =
    start.state.focusedIndex === lastIndex &&
    lastSegment !== undefined &&
    isSegmentFull(lastSegment) &&
    start.result.epochDay !== null;
  const focusEndSegment = end.segmentedField.focusSegment;
  useLayoutEffect(() => {
    if (isStartComplete) focusEndSegment(0);
  }, [isStartComplete, focusEndSegment]);
};

// Constraint: core typeDigit의 다음 칸 이동 조건과 같아야 함
const isSegmentFull = ({ maxDigits, maxValue, typedText }: Segment<DateSegmentKind>): boolean =>
  typedText.length >= maxDigits || Number(`${typedText}0`) > maxValue;
