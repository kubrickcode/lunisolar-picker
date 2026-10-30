import { formatTime, type TimeString } from '@lunisolar-picker/calendar';
import { type LocaleLabels, VALID } from '@lunisolar-picker/core';
import { type ReactElement, type Ref, useImperativeHandle, useRef, useState } from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  HiddenInput,
  type UseWheelTimeProps,
  useControllableState,
  usePickerSettings,
  useWheelTime,
  type ValueChangeDetails,
  Wheel,
  type WheelTimeApi,
} from '../index';
import type { PickerOpenProps } from './date-picker';
import { ClockIcon, ValueTrigger } from './default-trigger';
import { PickerClearButton } from './picker-clear-button';
import { PickerFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import { parseTimeValue, publicTimeOf, TIME_PARSE_KEY } from './time-value';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';
import { useFieldRemount } from './use-field-remount';
import { useInvalidValueReport } from './use-invalid-value-report';

// Constraint: 휠에는 24시 칸이 없어 24:00은 형식은 맞아도 허용하지 않는 값으로 다룸 (스펙 §4.1, TimePicker의 기본과 같음)
const IS_END_OF_DAY_ALLOWED = false;
const WHEEL_SELECTOR = `[${PART_ATTRIBUTE}="wheel"]`;

type InlineWheelProps = {
  readonly labelProps: WheelLabelProps;
  readonly ref: Ref<{ focus(): void }>;
  readonly wheelProps: UseWheelTimeProps;
};

type SheetWheelDraftProps = {
  readonly initialValue: TimeString | null;
  readonly label: string;
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onCancel: () => void;
  readonly onConfirm: (shownValue: TimeString) => void;
  readonly wheelProps: UseWheelTimeProps;
};

type WheelColumnsProps = {
  readonly labelProps: WheelLabelProps;
  readonly wheel: WheelTimeApi;
};

export interface WheelTimePickerProps extends UseWheelTimeProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  // Goal: 값이 있고 비활성·읽기 전용이 아니면 휠(시트면 트리거) 옆에 지우기 버튼을 보임. false면 그리지 않음 (스펙 2 clearable)
  readonly isClearable?: boolean | undefined;
  readonly placeholder?: string | undefined;
  // Goal: 태어난 시각처럼 휠을 화면에 바로 두거나(inline), 모바일에서 시트로 열어 확인을 눌러 반영함(sheet)
  readonly presentation?: 'inline' | 'sheet' | undefined;
  // Goal: ref.focus()가 휠의 시 열(시트면 트리거)에 포커스함. react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀 (스펙 7.6, preflight 3.7)
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
}

type WheelLabelProps = {
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-label': string;
  readonly 'aria-labelledby': string | undefined;
  readonly id: string | undefined;
};

export const WheelTimePicker = (props: WheelTimePickerProps): ReactElement => {
  // Constraint: 폼 참여(name·form·required)는 picker의 숨은 입력 하나가 맡고 Wheel.HiddenInput은 그리지 않음. 시트의 휠은 닫히면 언마운트되고, picker가 휠을 제어하므로 휠 쪽 reset은 무시되기 때문 (계약 §3.5)
  // Constraint: 값 해석(형식 오류, 24:00)은 picker가 TimePicker와 같은 규칙으로 하고 휠에는 허용된 시각만 넘김. 그래서 onInvalidValue는 inline·시트 모두 picker가 알림
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
    name,
    onBlur,
    onInvalidValue,
    onOpenChange,
    onValueChange,
    open,
    placeholder,
    presentation = 'inline',
    ref,
    renderTrigger,
    required,
    value,
    ...wheelProps
  } = props;
  const settings = usePickerSettings(props);
  // Constraint: 기본값은 M3 입력 부품처럼 조용히 해석함. 해석할 수 없는 기본값은 빈 값으로 시작하고 onInvalidValue는 제어 값에만 불림
  const [currentValue, setCurrentValue] = useControllableState<string | null>(
    value,
    parseTimeValue(defaultValue ?? null).time,
    undefined,
  );
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const [mountedDefault] = useState(() => defaultValue ?? null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { fieldKey, fieldRef, remountField } = useFieldRemount({ fieldSelector: WHEEL_SELECTOR, rootRef });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isSheet = presentation === 'sheet';
  const { labels } = settings.locale;
  const parsed = parseTimeValue(currentValue);
  const parsedTime = parsed.time;
  const publicTime = publicTimeOf(parsedTime, IS_END_OF_DAY_ALLOWED);
  const labelProps = {
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  };
  const toAppTriggerProps = useAppTriggerProps({ isOpen, labelProps, onBlur });

  const focusInput = (): void => {
    if (isSheet) triggerRef.current?.focus();
    else fieldRef.current?.focus();
  };
  useImperativeHandle(ref, () => ({ focus: focusInput }));
  useInvalidValueReport({
    calendarKey: TIME_PARSE_KEY,
    input: currentValue || null,
    isEnabled: true,
    onInvalidValue,
    reason: parsed.invalidReason,
  });

  const changeValue = (next: TimeString | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 확인은 시트에 보이는 시각을 확정함. 굴리지 않았어도 보이는 시각(값이 없거나 24:00이면 12:00, 칸 밖 분이면 내린 분)이 지금 값과 다르면 알림 (스펙 §4.3)
  // Constraint: 휠의 칸은 늘 허용된 시각이라 유효함
  const confirmShownValue = (shownValue: TimeString): void => {
    if (shownValue !== parsedTime) changeValue(shownValue, { validity: VALID });
    setOpen(false);
  };

  // Goal: M3 입력 부품과 같은 reset 규칙. 비제어만 마운트 때 기본값으로 돌아가며 알리고, 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 화면 값은 해석한 시각끼리, 알림은 폼에 내는 값끼리 비교함. 허용되지 않은 24:00은 폼 값이 비어 있어 빈 값과 같음 (TimePicker와 같음)
  const resetToDefault = (): void => {
    if (value !== undefined) return;
    const restored = parseTimeValue(mountedDefault).time;
    // Constraint: 휠은 값이 비어도 보이던 시각에 머물므로 다시 마운트해 빈 기본값이면 12:00을 보이게 함. 시트의 휠은 열 때마다 새로 마운트됨
    if (!isSheet) remountField();
    if (restored === parsedTime) return;
    setCurrentValue(restored);
    const restoredPublic = publicTimeOf(restored, IS_END_OF_DAY_ALLOWED);
    if (restoredPublic === publicTime) return;
    onValueChange?.(restoredPublic, { validity: VALID });
  };

  // Constraint: 빈 값은 VALID로 알림. 포커스를 먼저 옮겨, 값이 비며 사라지는 지우기 버튼과 함께 포커스가 body로 떨어지지 않게 함
  // Constraint: 휠은 값이 비어도 보이던 시각에 머물므로 form reset처럼 다시 마운트해 12:00을 보이고, 새 휠의 시 열로 포커스함
  const clearValue = (): void => {
    if (isSheet) focusInput();
    else remountField({ shouldFocusField: true });
    changeValue(null, { validity: VALID });
  };

  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement => {
    const appTriggerProps = toAppTriggerProps(triggerProps);
    const displayValue = parsedTime ?? '';
    return renderTrigger ? (
      renderTrigger({ displayValue, isOpen, placeholder: placeholder ?? '', triggerProps: appTriggerProps })
    ) : (
      <ValueTrigger
        triggerProps={appTriggerProps}
        label={ariaLabel ?? labels.chooseTime}
        icon={<ClockIcon />}
        placeholder={placeholder}
        text={displayValue}
      />
    );
  };

  // Constraint: 허용되지 않은 24:00은 형식 오류가 아니라 제약 위반이라 무효로 보임 (계약 §3.3 TimeField)
  const isVisiblyInvalid = wheelProps.invalid === true || (parsedTime !== null && publicTime === null);
  const isClearShown =
    isClearable && parsedTime !== null && wheelProps.disabled !== true && wheelProps.readOnly !== true;
  return (
    <div
      ref={rootRef}
      className={className}
      {...partAttributes('wheel-time-picker', {
        open: isSheet && isOpen,
        invalid: isVisiblyInvalid,
        placeholder: isSheet && parsedTime === null,
      })}
    >
      {isSheet ? (
        <PickerSurface
          presentation="sheet"
          isOpen={isOpen}
          isDisabled={wheelProps.disabled === true}
          isReadOnly={wheelProps.readOnly === true}
          onOpenChange={setOpen}
          label={ariaLabel ?? labels.chooseTime}
          renderTrigger={renderPickerTrigger}
          triggerRef={triggerRef}
        >
          <SheetWheelDraft
            initialValue={publicTime}
            label={labels.chooseTime}
            labels={labels}
            wheelProps={wheelProps}
            onCancel={() => setOpen(false)}
            onConfirm={confirmShownValue}
          />
        </PickerSurface>
      ) : (
        <InlineWheel
          key={fieldKey}
          ref={fieldRef}
          labelProps={{ ...labelProps, 'aria-label': ariaLabel ?? labels.chooseTime }}
          wheelProps={{
            ...wheelProps,
            invalid: isVisiblyInvalid,
            onBlur,
            value: publicTime,
            onValueChange: changeValue,
          }}
        />
      )}
      {isClearShown ? <PickerClearButton label={labels.clear} onClear={clearValue} /> : null}
      <HiddenInput
        name={name}
        form={form}
        required={required}
        disabled={wheelProps.disabled}
        value={publicTime ?? ''}
        onFocusRequest={focusInput}
        onFormReset={resetToDefault}
      />
    </div>
  );
};

const InlineWheel = ({ labelProps, ref, wheelProps }: InlineWheelProps): ReactElement => {
  const wheel = useWheelTime(wheelProps);
  useImperativeHandle(ref, () => ({ focus: wheel.focus }), [wheel.focus]);
  return <WheelColumns wheel={wheel} labelProps={labelProps} />;
};

// Goal: 시트 안 휠은 굴리는 동안 값을 바꾸지 않고 확인을 눌러야 반영함. 시트가 닫히면 언마운트되어 임시 값도 버려짐
// Constraint: 초안은 비제어라 열린 동안 부모가 값을 바꿔도 덮이지 않음
const SheetWheelDraft = ({
  initialValue,
  label,
  labels,
  onCancel,
  onConfirm,
  wheelProps,
}: SheetWheelDraftProps): ReactElement => {
  const wheel = useWheelTime({ ...wheelProps, defaultValue: initialValue });
  return (
    <>
      <WheelColumns
        wheel={wheel}
        labelProps={{ id: undefined, 'aria-describedby': undefined, 'aria-label': label, 'aria-labelledby': undefined }}
      />
      <PickerFooter
        labels={labels}
        isConfirmDisabled={false}
        onCancel={onCancel}
        onConfirm={() => {
          // Constraint: 휠의 칸은 늘 적을 수 있는 시각이라 실패하지 않음. 타입을 좁히려는 방어 검사
          const shownValue = formatTime(wheel.fields.hour, wheel.fields.minute);
          if (shownValue.isOk) onConfirm(shownValue.value);
        }}
      />
    </>
  );
};

const WheelColumns = ({ labelProps, wheel }: WheelColumnsProps): ReactElement => (
  <Wheel.Root {...wheel.getWheelRootProps()} {...labelProps}>
    <Wheel.Column
      options={wheel.columns.hours}
      value={wheel.fields.hour}
      onValueChange={wheel.selectHour}
      label={wheel.labels.hour}
    />
    <Wheel.Column
      options={wheel.columns.minutes}
      value={wheel.fields.minute}
      onValueChange={wheel.selectMinute}
      label={wheel.labels.minute}
    />
    <Wheel.Highlight />
  </Wheel.Root>
);
