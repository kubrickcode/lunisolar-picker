import { LunisolarPickerError, type TimeString } from '@lunisolar-picker/calendar';
import {
  createTimeFieldState,
  type TimeFieldContext,
  type TimeFieldEvent,
  type TimeFieldState,
  timeFieldReducer,
  timeFieldResult,
  type Validity,
} from '@lunisolar-picker/core';
import { type HTMLAttributes, type RefCallback, useCallback, useMemo, useState } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type SegmentDescription, type SegmentedField, useSegmentedField } from '../segments/use-segmented-field';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { type PickerSettings, usePickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { type ParsedControlledValue, parseOptionalTime } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

const DEFAULT_MINUTE_STEP = 1;
const END_OF_DAY = '24:00';
const PARSE_KEY = 'well-formed-time';
const TIME_PART_DIGITS = 2;

export interface TimeFieldApi {
  readonly state: TimeFieldState;
  readonly value: TimeString | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly segmentedField: SegmentedField;
  send(event: TimeFieldEvent): void;
  focus(): void;
  getRootProps(): TimeFieldRootProps;
  getSeparatorProps(): HTMLAttributes<HTMLSpanElement> & DataAttributeProps;
  getHiddenInputProps(): HiddenInputProps;
}

export type TimeFieldRootProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLElement> };

export interface UseTimeFieldProps extends SharedPickerProps {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: TimeString | null, details: ValueChangeDetails) => void) | undefined;
  readonly minuteStep?: number | undefined;
  readonly isEndOfDayAllowed?: boolean | undefined;
}

export const useTimeField = (props: UseTimeFieldProps): TimeFieldApi => {
  const settings = usePickerSettings(props);
  const isEndOfDayAllowed = props.isEndOfDayAllowed === true;
  const minuteStep = props.minuteStep ?? DEFAULT_MINUTE_STEP;
  const controlled = useParsedValue(props.value, parseWellFormedTime, String, props.onInvalidValue, PARSE_KEY);
  const [initialValue] = useState(() => controlled.value ?? parseWellFormedTime(props.defaultValue).value);
  const context: TimeFieldContext = useMemo(() => ({ minuteStep, isEndOfDayAllowed }), [minuteStep, isEndOfDayAllowed]);
  // Goal: 시 칸 최댓값(23 또는 24)은 store 생성 때 고정되므로 24:00 허용 여부가 바뀌면 store를 새로 만듦. 이전 칸 값은 유지해 onValueChange가 불리지 않음 (preflight 3.9)
  const { state, send } = useStoreInstance(
    (previous: TimeFieldState | undefined) =>
      previous === undefined ? createTimeFieldState(initialValue, context) : rebuildWithContext(previous, context),
    timeFieldReducer,
    context,
    { resetKey: String(isEndOfDayAllowed) },
  );
  const result = useMemo(() => timeFieldResult(state, context), [state, context]);
  // Constraint: 허용 여부가 꺼져도 store 값은 24:00 그대로 둠. 설정이 바뀐다고 값이 비어 보이면 부모가 진짜 비움과 구별하지 못함
  const storeTime = useMemo(() => timeFieldResult(state, withEndOfDayAllowed(context)).time, [state, context]);
  const isDisabled = props.disabled === true;
  const isReadOnly = props.readOnly === true;
  const isInvalid = isVisiblyInvalid({ invalid: props.invalid === true, reasons: result.validity.reasons });

  const segmentedField = useSegmentedField({
    focusedIndex: state.focusedIndex,
    describeSegment: (index) => describeTimeSegment(state, index, settings),
    // Constraint: 시간 입력에는 윤달이 없음. 공용 키 해석이 만든 윤달 명령은 버림
    sendCommand: (command) => {
      if (command.type !== 'leapMonth.toggle') send(command);
    },
    segmentPart: 'time-field-segment',
    isDisabled,
    isReadOnly,
    isInvalid,
    isRequired: props.required === true,
  });

  useValueBridge<TimeString>({
    committedValue: storeTime,
    controlled,
    isEqual: Object.is,
    syncStore: (next) => send({ type: 'value.sync', time: next }),
    // Goal: 허용되지 않는 24:00은 제약 위반으로 화면에 남기되 부모에게는 빈 값으로 알림
    toPublic: (time) => (time === END_OF_DAY && !isEndOfDayAllowed ? null : time),
    onValueChange: (next) => props.onValueChange?.(next, { validity: result.validity }),
  });

  const { focusSegment } = segmentedField;
  const focus = useCallback(() => focusSegment(0), [focusSegment]);
  // Goal: 비제어일 때만 form reset으로 처음 기본값으로 돌아감. 제어 값은 부모가 정함
  const resetToDefault = (): void => {
    if (!controlled.isControlled) send({ type: 'value.sync', time: initialValue });
  };

  return {
    state,
    value: result.time,
    validity: result.validity,
    isInvalid,
    isDisabled,
    isReadOnly,
    segmentedField,
    send,
    focus,
    getRootProps: () => ({
      ref: segmentedField.rootRef,
      role: 'group',
      onBlur: createFocusLeaveListener(props.onBlur),
      ...partAttributes('time-field', {
        invalid: isInvalid,
        disabled: isDisabled,
        readonly: isReadOnly,
        focused: segmentedField.isFocusWithin,
      }),
    }),
    getSeparatorProps: () => ({ 'aria-hidden': true, ...partAttributes('time-field-separator') }),
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: result.time ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: focus,
      onFormReset: resetToDefault,
    }),
  };
};

const describeTimeSegment = (state: TimeFieldState, index: number, settings: PickerSettings): SegmentDescription => {
  const segment = state.segments[index];
  if (segment === undefined) {
    throw new LunisolarPickerError(`TimeField.Segment index ${index} is out of range (0-${state.segments.length - 1})`);
  }
  const { locale } = settings;
  const valueDisplay = segment.value === null ? null : String(segment.value).padStart(TIME_PART_DIGITS, '0');
  const placeholder = locale.field.placeholder[segment.kind];
  return {
    label: locale.labels[segment.kind],
    displayText: segment.typedText !== '' ? segment.typedText : (valueDisplay ?? placeholder),
    valueText: valueDisplay ?? placeholder,
    isPlaceholder: segment.value === null && segment.typedText === '',
    minValue: segment.minValue,
    maxValue: segment.maxValue,
    value: segment.value,
    canToggleLeapMonth: false,
  };
};

const withEndOfDayAllowed = (context: TimeFieldContext): TimeFieldContext => ({ ...context, isEndOfDayAllowed: true });

const parseWellFormedTime = (input: string | null | undefined): ParsedControlledValue<TimeString> =>
  parseOptionalTime(input, { isEndOfDayAllowed: true });

const rebuildWithContext = (previous: TimeFieldState, context: TimeFieldContext): TimeFieldState => {
  const fresh = createTimeFieldState(null, context);
  return {
    ...previous,
    segments: fresh.segments.map((freshSegment, index) => ({
      ...freshSegment,
      typedText: previous.segments[index]?.typedText ?? '',
      value: previous.segments[index]?.value ?? null,
    })),
  };
};
