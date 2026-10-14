import type { TimeString } from '@lunisolar-picker/calendar';
import {
  createTimeFieldState,
  type Segment,
  type TimeFieldContext,
  type TimeFieldEvent,
  type TimeFieldState,
  type TimeSegmentKind,
  timeFieldReducer,
  timeFieldResult,
  type Validity,
} from '@lunisolar-picker/core';
import { type HTMLAttributes, type RefCallback, useMemo, useState } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { type SegmentDescription, type SegmentedField, useSegmentedField } from '../segments/use-segmented-field';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { type PickerSettings, usePickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import type { HiddenInputProps } from '../value/hidden-input';
import { parseOptionalTime } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

const DEFAULT_MINUTE_STEP = 1;
const TIME_PART_DIGITS = 2;

export interface UseTimeFieldProps extends SharedPickerProps {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: TimeString | null, details: ValueChangeDetails) => void) | undefined;
  readonly minuteStep?: number | undefined;
  readonly isEndOfDayAllowed?: boolean | undefined;
}

export interface TimeFieldApi {
  readonly state: TimeFieldState;
  readonly value: TimeString | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly segmentedField: SegmentedField;
  send(event: TimeFieldEvent): void;
  focus(): void;
  getRootProps(): TimeFieldRootProps;
  getSeparatorProps(): HTMLAttributes<HTMLSpanElement> & DataAttributeProps;
  getHiddenInputProps(): HiddenInputProps;
}

export type TimeFieldRootProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLElement> };

export const useTimeField = (props: UseTimeFieldProps): TimeFieldApi => {
  const settings = usePickerSettings(props);
  const isEndOfDayAllowed = props.isEndOfDayAllowed === true;
  const minuteStep = props.minuteStep ?? DEFAULT_MINUTE_STEP;
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalTime(input, { isEndOfDayAllowed }),
    String,
    props.onInvalidValue,
    String(isEndOfDayAllowed),
  );
  const [initialValue] = useState(
    () => controlled.value ?? parseOptionalTime(props.defaultValue, { isEndOfDayAllowed }).value,
  );
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
  const isDisabled = props.disabled === true;
  const isInvalid =
    props.invalid === true || (!result.validity.isValid && !result.validity.reasons.includes('incomplete'));

  const segmentedField = useSegmentedField({
    focusedIndex: state.focusedIndex,
    describeSegment: (index) => describeTimeSegment(state, index, settings),
    // Constraint: 시간 입력에는 윤달이 없음. 공용 키 해석이 만든 윤달 명령은 버림
    sendCommand: (command) => {
      if (command.type !== 'leapMonth.toggle') send(command);
    },
    segmentPart: 'time-field-segment',
    isDisabled,
    isReadOnly: props.readOnly === true,
    isInvalid,
    isRequired: props.required === true,
  });

  useValueBridge<TimeString>({
    committedValue: result.time,
    controlled,
    isEqual: Object.is,
    syncStore: (next) => send({ type: 'value.sync', time: next }),
    onValueChange: (next) => props.onValueChange?.(next, { validity: result.validity }),
  });

  const focus = (): void => segmentedField.focusSegment(0);

  return {
    state,
    value: result.time,
    validity: result.validity,
    isInvalid,
    isDisabled,
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
        readonly: props.readOnly === true,
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
    }),
  };
};

const describeTimeSegment = (state: TimeFieldState, index: number, settings: PickerSettings): SegmentDescription => {
  const segment = state.segments[index] as Segment<TimeSegmentKind>; // as: 칸 개수는 store가 고정하고 부품이 그 안의 index만 넘김
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
