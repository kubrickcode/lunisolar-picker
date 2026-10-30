import type { TimeString } from '@lunisolar-picker/calendar';
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
import { PickerClearButton } from './picker-clear-button';
import { PickerCloseFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import { parseTimeValue, publicTimeOf, TIME_PARSE_KEY } from './time-value';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';
import { useFieldRemount } from './use-field-remount';
import { useInvalidValueReport } from './use-invalid-value-report';

const DEFAULT_MINUTE_STEP = 30;
const FIELD_SELECTOR = `[${PART_ATTRIBUTE}="time-field"]`;

export interface TimePickerProps extends UseTimeFieldProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  // Goal: 값이 있고 비활성·읽기 전용이 아니면 입력 칸(앱 트리거를 쓰면 트리거) 옆에 지우기 버튼을 보임. false면 그리지 않음 (스펙 2 clearable)
  readonly isClearable?: boolean | undefined;
  // Goal: 받아들인 목록 고르기마다(이미 고른 시각을 다시 골라도) 알림. onValueChange는 값이 바뀔 때만 (계약 §3.4 onPick)
  readonly onPick?: ((value: TimeString) => void) | undefined;
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
    isClearable = true,
    isEndOfDayAllowed = false,
    minuteStep = DEFAULT_MINUTE_STEP,
    name,
    onBlur,
    onInvalidValue,
    onOpenChange,
    onPick,
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
  const closeOnPick = (picked: TimeString): void => {
    onPick?.(picked);
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

  // Constraint: 빈 값은 VALID로 알림. 포커스를 먼저 옮겨, 값이 비며 사라지는 지우기 버튼과 함께 포커스가 body로 떨어지지 않게 함
  const clearValue = (): void => {
    focusInput();
    changeValue(null, { validity: VALID });
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
  const isClearShown =
    isClearable && parsedTime !== null && sharedProps.disabled !== true && sharedProps.readOnly !== true;
  const clearButton = isClearShown ? <PickerClearButton label={labels.clear} onClear={clearValue} /> : null;
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
      {isTriggerMode ? null : clearButton}
      <PickerSurface
        presentation={resolvedPresentation}
        isOpen={isOpen}
        // Constraint: 입력 칸이 있으면 읽기 전용이어도 입력 칸이 포커스를 받으므로 아이콘 버튼은 비활성으로 둠. 앱 트리거는 입력 자리라 포커스를 받게 둠
        isDisabled={sharedProps.disabled === true || (sharedProps.readOnly === true && !isTriggerMode)}
        isReadOnly={sharedProps.readOnly === true}
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
      {isTriggerMode ? clearButton : null}
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
