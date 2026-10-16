import { parseTime, type TimeString, type ValidationReason } from '@lunisolar-picker/calendar';
import { VALID } from '@lunisolar-picker/core';
import { type ReactElement, type Ref, useImperativeHandle, useRef, useState } from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  HiddenInput,
  type Presentation,
  TimeField,
  TimeList,
  type UseTimeFieldProps,
  useControllableState,
  usePickerSettings,
  usePresentation,
  type ValueChangeDetails,
} from '../index';
import type { PickerOpenProps } from './date-picker';
import { ClockIcon, DefaultTrigger } from './default-trigger';
import { PickerCloseFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';
import { useFieldRemount } from './use-field-remount';
import { useInvalidValueReport } from './use-invalid-value-report';

const DEFAULT_MINUTE_STEP = 30;
const EMPTY_TIME: ParsedTimeValue = { invalidReason: null, time: null };
const END_OF_DAY = '24:00';
const FIELD_SELECTOR = `[${PART_ATTRIBUTE}="time-field"]`;
// Constraint: 시각 문자열은 역법 구성과 무관하므로 역법 목록이 바뀌어도 같은 값을 다시 알리지 않음
const TIME_PARSE_KEY = 'well-formed-time';

type ParsedTimeValue = {
  readonly invalidReason: ValidationReason | null;
  readonly time: TimeString | null;
};

export interface TimePickerProps extends UseTimeFieldProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly presentation?: Presentation | undefined;
  // Goal: ref.focus()가 입력 칸의 첫 칸(앱 트리거를 쓰면 그 트리거)에 포커스함. react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀 (스펙 7.6, preflight 3.7)
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
}

export const TimePicker = (props: TimePickerProps): ReactElement => {
  // Constraint: 폼 참여(name·form)는 picker의 숨은 입력 하나가 맡음. 입력 칸이 없는 앱 트리거에서도 제출·reset·required가 같게 동작함 (계약 §3.5)
  // Constraint: onBlur·onInvalidValue·ref·라벨은 입력 칸(앱 트리거를 쓰면 트리거 쪽)만 받음. 목록이 열릴 때마다 같은 오류를 또 알리지 않게 함
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    defaultOpen,
    defaultValue,
    form,
    id,
    isEndOfDayAllowed = false,
    minuteStep = DEFAULT_MINUTE_STEP,
    name,
    onBlur,
    onInvalidValue,
    onOpenChange,
    onValueChange,
    open,
    placeholder = '',
    presentation = 'auto',
    ref,
    renderTrigger,
    required,
    value,
    ...sharedProps
  } = props;
  const settings = usePickerSettings(props);
  const resolvedPresentation = usePresentation(presentation);
  // Constraint: 기본값은 M3 입력 부품처럼 조용히 해석함. 해석할 수 없는 기본값은 빈 값으로 시작하고 onInvalidValue는 제어 값에만 불림
  const [currentValue, setCurrentValue] = useControllableState<string | null>(
    value,
    parseTimeValue(defaultValue ?? null).time,
    undefined,
  );
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const [mountedDefault] = useState(() => defaultValue ?? null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { fieldKey, fieldRef, remountField } = useFieldRemount({ fieldSelector: FIELD_SELECTOR, rootRef });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isTriggerMode = renderTrigger !== undefined;
  const { labels } = settings.locale;
  const parsed = parseTimeValue(currentValue);
  const parsedTime = parsed.time;
  const publicTime = publicTimeOf(parsedTime, isEndOfDayAllowed);
  const toAppTriggerProps = useAppTriggerProps({
    isOpen,
    labelProps: {
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
    },
    onBlur,
  });

  const focusInput = (): void => {
    if (isTriggerMode) triggerRef.current?.focus();
    else fieldRef.current?.focus();
  };
  useImperativeHandle(ref, () => ({ focus: focusInput }));
  useInvalidValueReport({
    calendarKey: TIME_PARSE_KEY,
    input: currentValue || null,
    isEnabled: isTriggerMode,
    onInvalidValue,
    reason: parsed.invalidReason,
  });

  const changeValue = (next: TimeString | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 이미 고른 시각을 다시 골라도 닫힘. onValueChange는 값이 바뀔 때만 오므로 고르기 신호로 닫음 (계약 §3.4 onPick)
  const closeOnPick = (): void => {
    setOpen(false);
  };

  // Goal: M3 입력 부품과 같은 reset 규칙. 비제어만 마운트 때 기본값으로 돌아가며 알리고, 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 화면 값은 해석한 시각끼리, 알림은 폼에 내는 값끼리 비교함. 허용되지 않은 24:00은 폼 값이 비어 있어 빈 값과 같음
  // Constraint: 목록에서 고른 값과 폼에 내는 값은 늘 형식이 맞고 허용된 시각이라 유효함
  const resetToDefault = (): void => {
    if (value !== undefined) return;
    const restored = parseTimeValue(mountedDefault).time;
    remountField();
    if (restored === parsedTime) return;
    setCurrentValue(restored);
    const restoredPublic = publicTimeOf(restored, isEndOfDayAllowed);
    if (restoredPublic === publicTime) return;
    onValueChange?.(restoredPublic, { validity: VALID });
  };

  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement =>
    renderTrigger ? (
      renderTrigger({
        displayValue: parsedTime ?? '',
        isOpen,
        placeholder,
        triggerProps: toAppTriggerProps(triggerProps),
      })
    ) : (
      <DefaultTrigger triggerProps={triggerProps} label={labels.chooseTime} icon={<ClockIcon />} />
    );

  // Constraint: 허용되지 않은 24:00은 형식 오류가 아니라 제약 위반이라 입력 칸처럼 무효로 보임 (계약 §3.3 TimeField)
  const isVisiblyInvalid = sharedProps.invalid === true || (parsedTime !== null && publicTime === null);
  return (
    <div
      ref={rootRef}
      className={className}
      {...partAttributes('time-picker', { open: isOpen, invalid: isVisiblyInvalid })}
    >
      {isTriggerMode ? null : (
        <TimeField.Root
          key={fieldKey}
          {...sharedProps}
          ref={fieldRef}
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          isEndOfDayAllowed={isEndOfDayAllowed}
          minuteStep={minuteStep}
          required={required}
          onBlur={onBlur}
          onInvalidValue={onInvalidValue}
          value={currentValue}
          onValueChange={changeValue}
        />
      )}
      <PickerSurface
        presentation={resolvedPresentation}
        isOpen={isOpen}
        isDisabled={sharedProps.disabled === true || sharedProps.readOnly === true}
        onOpenChange={setOpen}
        label={ariaLabel ?? labels.chooseTime}
        renderTrigger={renderPickerTrigger}
        triggerRef={triggerRef}
      >
        <TimeList.Root
          aria-label={labels.chooseTime}
          isEndOfDayAllowed={isEndOfDayAllowed}
          minuteStep={minuteStep}
          value={currentValue}
          onValueChange={changeValue}
          onPick={closeOnPick}
        />
        {resolvedPresentation === 'sheet' ? <PickerCloseFooter label={labels.close} /> : null}
      </PickerSurface>
      <HiddenInput
        name={name}
        form={form}
        required={required}
        disabled={sharedProps.disabled}
        value={publicTime ?? ''}
        onFocusRequest={focusInput}
        onFormReset={resetToDefault}
      />
    </div>
  );
};

// Constraint: 형식만 보고 24:00을 받아 둠. 허용 여부는 폼에 낼 때(publicTimeOf) 따로 봄 (TimeField와 같음)
const parseTimeValue = (value: string | null): ParsedTimeValue => {
  if (!value) return EMPTY_TIME;
  const parsed = parseTime(value, { isEndOfDayAllowed: true });
  return parsed.isOk ? { invalidReason: null, time: parsed.value.value } : { invalidReason: parsed.error, time: null };
};

const publicTimeOf = (time: TimeString | null, isEndOfDayAllowed: boolean): TimeString | null =>
  time === END_OF_DAY && !isEndOfDayAllowed ? null : time;
