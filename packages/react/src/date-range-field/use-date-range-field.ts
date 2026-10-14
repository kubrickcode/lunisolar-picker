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
  canTakeAnotherDigit,
  type DateFieldResult,
  type EpochRange,
  invalidBecause,
  type RangeConstraints,
  type SelectedDay,
  VALID,
  type Validity,
  validateEpochRange,
} from '@lunisolar-picker/core';
import { type FocusEvent, type HTMLAttributes, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type DateFieldCore, useDateFieldSegments, useDateFieldStore } from '../date-field/use-date-field-core';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { type DateRangeInput, parseOptionalRange } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

const INCOMPLETE_REASON: ValidationReason = 'incomplete';
// Goal: 한 날짜가 아니라 범위 전체에 걸린 이유. 양 끝 칸 모두에 무효를 표시함
const RANGE_LEVEL_REASONS: ReadonlySet<ValidationReason> = new Set([
  'range-includes-disabled',
  'range-too-long',
  'range-too-short',
]);

type CombineRangeInput = {
  readonly calendar: CalendarSystem;
  readonly endEpochDay: EpochDay | null;
  readonly startEpochDay: EpochDay | null;
};

export interface DateRangeFieldApi {
  readonly start: DateFieldCore;
  readonly end: DateFieldCore;
  readonly value: DateRangeValue | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
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
  readonly endResult: DateFieldResult;
  // Constraint: 시작일이 없어 범위를 만들 수 없으면 null
  readonly rangeReasons: readonly ValidationReason[] | null;
  readonly startResult: DateFieldResult;
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
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalRange(input, settings.calendars),
    describeRangeInput,
    props.onInvalidValue,
    settings.calendarKey,
  );
  const [initialValue] = useState(
    () => controlled.value ?? parseOptionalRange(props.defaultValue, settings.calendars).value,
  );
  // Constraint: 값이 있으면 start의 역법이 양 끝의 입력 역법이 됨. 끝이 비어 있는(열린) 범위의 end도 같은 역법으로 시작해야 함 (계약 §3.3)
  const initialEntryCalendarId =
    initialValue === null
      ? (props.entryCalendar ?? props.defaultEntryCalendar ?? gregory.id)
      : calendarIdOf(initialValue.start);
  const storeOptions = {
    settings,
    constraints: props,
    isControlled: controlled.isControlled,
    initialEntryCalendarId,
    requestedEntryCalendarId: props.entryCalendar,
  };
  const startStore = useDateFieldStore({
    ...storeOptions,
    initialSelected: selectedDayOf(initialValue?.start ?? null),
  });
  const endStore = useDateFieldStore({ ...storeOptions, initialSelected: selectedDayOf(initialValue?.end ?? null) });
  const isOpenEndAllowed = props.isOpenEndAllowed === true;

  // Goal: store가 담고 있는 범위(시작일만 있어도 끝 null로 둠). 열린 끝 허용 여부와 무관하게 비교해야 반쪽 제어 값이 마운트에서 알림을 내지 않음
  // Goal: 입력 역법의 단일 출처는 store. 양 끝 store는 같은 역법으로만 바뀌므로 start 쪽 역법으로 둘 다 표기함
  const enteredRange = useMemo(
    () =>
      combineRange({
        startEpochDay: startStore.result.epochDay,
        endEpochDay: endStore.result.epochDay,
        calendar: startStore.entryCalendar,
      }),
    [startStore.result.epochDay, endStore.result.epochDay, startStore.entryCalendar],
  );
  const value = useMemo(() => publicRangeOf(enteredRange, isOpenEndAllowed), [enteredRange, isOpenEndAllowed]);
  const constraints = startStore.context.constraints;
  const rangeReasons = useMemo(
    () => (enteredRange === null ? null : validateEpochRange(epochRangeOf(enteredRange), constraints).reasons),
    [enteredRange, constraints],
  );
  const validity = useMemo(
    () => rangeValidity({ rangeReasons, startResult: startStore.result, endResult: endStore.result }),
    [rangeReasons, startStore.result, endStore.result],
  );
  // Constraint: 이유는 양 끝의 합집합이라, 한쪽이 입력 중(incomplete)이어도 다른 이유가 있으면 무효로 표시해야 함
  const isInvalid = isVisiblyInvalid({ invalid: props.invalid === true, reasons: validity.reasons });
  const isDisabled = props.disabled === true;
  const isReadOnly = props.readOnly === true;
  const hasRangeLevelReason = rangeReasons?.some((reason) => RANGE_LEVEL_REASONS.has(reason)) ?? false;

  // Goal: 범위 전체의 무효(range-too-long 등)는 양 끝 칸의 aria-invalid·data-invalid로도 알림 (WCAG 1.3.1·3.3.1·4.1.2). 한 날짜의 이유는 그 끝에만 표시함(core가 자기 결과로 더함)
  const segmentsOptions = {
    settings,
    separator: props.separator,
    isDisabled,
    isReadOnly,
    isInvalidFromOwner: props.invalid === true || hasRangeLevelReason,
  };
  const isRequiredBySide: Readonly<Record<RangeSide, boolean>> = {
    start: props.required === true,
    // Constraint: 열린 범위가 허용되면 종료일은 선택 입력
    end: props.required === true && !isOpenEndAllowed,
  };
  const start = useDateFieldSegments(startStore, { ...segmentsOptions, isRequired: isRequiredBySide.start });
  const end = useDateFieldSegments(endStore, { ...segmentsOptions, isRequired: isRequiredBySide.end });

  useMoveToEndWhenStartCompletes(start, end);

  // Constraint: 밖에서 정한 범위(부모 값·form reset의 기본값)가 다른 역법으로 적혀 있으면 양 끝 store의 입력 역법도 그 역법이 됨(값의 역법 우선). 부모가 한 일이라 onEntryCalendarChange는 부르지 않음
  const syncRange = (next: DateRangeValue | null): void => {
    const entryCalendarId = next === null ? startStore.state.entryCalendarId : calendarIdOf(next.start);
    start.send({ type: 'value.sync', selected: selectedDayOf(next?.start ?? null), entryCalendarId });
    end.send({ type: 'value.sync', selected: selectedDayOf(next?.end ?? null), entryCalendarId });
  };

  useValueBridge<DateRangeValue>({
    committedValue: enteredRange,
    controlled,
    isEqual: isSameRange,
    syncStore: syncRange,
    // Goal: 반쪽 범위는 열린 끝이 허용될 때만 공개 값. 부모가 되돌려 준 null이 store의 시작일을 지우지 않음
    toPublic: (next) => publicRangeOf(next, isOpenEndAllowed),
    onValueChange: (next) => props.onValueChange?.(next, { validity }),
  });

  // Goal: 뒤집힌 범위는 포커스가 범위를 벗어날 때 store에서 두 끝을 바꿔 화면도 정렬함 (스펙 4.2). 확정 값은 이미 정렬돼 있어 알림이 없음
  // Constraint: 키 입력마다 바꾸면 입력 중인 칸이 다른 쪽으로 튐
  const swapReversedEnds = (): void => {
    const startEpochDay = startStore.result.epochDay;
    const endEpochDay = endStore.result.epochDay;
    if (startEpochDay === null || endEpochDay === null || startEpochDay <= endEpochDay) return;
    const entryCalendarId = startStore.state.entryCalendarId;
    start.send({
      type: 'value.sync',
      selected: { epochDay: endEpochDay, calendarId: entryCalendarId },
      entryCalendarId,
    });
    end.send({
      type: 'value.sync',
      selected: { epochDay: startEpochDay, calendarId: entryCalendarId },
      entryCalendarId,
    });
  };
  const onFocusLeave = (): void => {
    swapReversedEnds();
    props.onBlur?.();
  };
  const focusStartSegment = start.segmentedField.focusSegment;
  const focus = useCallback(() => focusStartSegment(0), [focusStartSegment]);
  // Goal: 비제어일 때만 form reset으로 처음 기본 범위로 돌아감. 양 끝 hidden input이 둘 다 알려도 같은 값으로 맞추므로 한 번 바뀐 것과 같음
  const resetToDefault = (): void => {
    if (!controlled.isControlled) syncRange(initialValue);
  };
  // Constraint: DateField와 같은 정책. 사용자가 바꾼 역법은 부모가 제어해도 바로 반영하고 알림
  const setEntryCalendar = (calendarId: CalendarId): void => {
    if (calendarId === startStore.state.entryCalendarId) return;
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
    isDisabled,
    isReadOnly,
    entryCalendarId: startStore.state.entryCalendarId,
    setEntryCalendar,
    focus,
    getRootProps: () => ({
      role: 'group',
      // Constraint: 시작·종료 칸 사이 이동은 필드 안이므로 그룹 전체를 벗어날 때만 알림
      onBlur: createFocusLeaveListener(onFocusLeave),
      ...partAttributes('date-range-field', {
        invalid: isInvalid,
        disabled: isDisabled,
        readonly: isReadOnly,
        focused: start.segmentedField.isFocusWithin || end.segmentedField.isFocusWithin,
        calendar: startStore.state.entryCalendarId,
      }),
    }),
    getRangeSeparatorProps: () => ({ 'aria-hidden': true, ...partAttributes('date-field-separator') }),
    getHiddenInputProps: (side) => ({
      name: side === 'start' ? props.startName : props.endName,
      form: props.form,
      value: (side === 'start' ? value?.start : value?.end) ?? '',
      required: isRequiredBySide[side],
      disabled: props.disabled,
      onFocusRequest: () => sideCores[side].segmentedField.focusSegment(0),
      onFormReset: resetToDefault,
    }),
  };
};

const describeRangeInput = (input: DateRangeInput): string => `${input.start}/${input.end ?? ''}`;

const selectedDayOf = (date: DateString | null): SelectedDay | null =>
  date === null ? null : { epochDay: epochDayOf(date), calendarId: calendarIdOf(date) };

const combineRange = ({ calendar, endEpochDay, startEpochDay }: CombineRangeInput): DateRangeValue | null => {
  const startValue = formatOrNull(startEpochDay, calendar);
  if (startValue === null) return null;
  const normalized = normalizeDateRange(startValue, formatOrNull(endEpochDay, calendar));
  return normalized.isOk ? normalized.value : null;
};

const epochRangeOf = ({ start, end }: DateRangeValue): EpochRange => ({
  start: epochDayOf(start),
  end: end === null ? null : epochDayOf(end),
});

const publicRangeOf = (range: DateRangeValue | null, isOpenEndAllowed: boolean): DateRangeValue | null =>
  range === null || (range.end === null && !isOpenEndAllowed) ? null : range;

// Goal: 빈 범위는 유효(빨간 테두리 없음). 반만 친 범위는 'incomplete'를 알림 (preflight 2.8)
const rangeValidity = ({ endResult, rangeReasons, startResult }: RangeValidityInput): Validity => {
  const fieldReasons = [...startResult.validity.reasons, ...endResult.validity.reasons];
  if (rangeReasons !== null) return invalidBecause([...fieldReasons, ...rangeReasons]);
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
    !canTakeAnotherDigit(lastSegment) &&
    start.result.epochDay !== null;
  const focusEndSegment = end.segmentedField.focusSegment;
  useLayoutEffect(() => {
    if (isStartComplete) focusEndSegment(0);
  }, [isStartComplete, focusEndSegment]);
};
