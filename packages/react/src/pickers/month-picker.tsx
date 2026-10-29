import { gregory, type MonthString, parseMonth, toMonthCode, type ValidationReason } from '@lunisolar-picker/calendar';
import { invalidBecause, type LocaleData, VALID, type Validity } from '@lunisolar-picker/core';
import { type ReactElement, type Ref, useImperativeHandle, useRef, useState } from 'react';
import { partAttributes } from '../contract/data-attributes';
import {
  HiddenInput,
  MonthCalendar,
  type Presentation,
  type UseMonthCalendarProps,
  useControllableState,
  usePickerSettings,
  usePresentation,
  type ValueChangeDetails,
} from '../index';
import type { PickerOpenProps } from './date-picker';
import { CalendarIcon, ValueTrigger } from './default-trigger';
import { PickerClearButton } from './picker-clear-button';
import { PickerCloseFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';
import { useInvalidValueReport } from './use-invalid-value-report';

const EMPTY_MONTH: ParsedMonthValue = { invalidReason: null, month: null };
// Constraint: 월 문자열은 양력 연·월이라 역법 구성과 무관하므로 역법 목록이 바뀌어도 같은 값을 다시 알리지 않음 (MonthCalendar와 같음)
const MONTH_PARSE_KEY = 'month-string';

type MonthBounds = {
  readonly max: MonthString | null;
  readonly min: MonthString | null;
};

export interface MonthPickerProps extends UseMonthCalendarProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  // Goal: 값이 있고 비활성·읽기 전용이 아니면 트리거 옆에 지우기 버튼을 보임. false면 그리지 않음 (스펙 2 clearable)
  readonly isClearable?: boolean | undefined;
  readonly placeholder?: string | undefined;
  readonly presentation?: Presentation | undefined;
  // Goal: ref.focus()가 트리거에 포커스함. 입력 칸이 없으므로 트리거가 picker의 입력 자리임 (스펙 7.6, preflight 3.7)
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
}

type MonthValidityInput = {
  readonly bounds: MonthBounds;
  readonly month: MonthString | null;
};

type ParsedMonthValue = {
  readonly invalidReason: ValidationReason | null;
  readonly month: MonthString | null;
};

export const MonthPicker = (props: MonthPickerProps): ReactElement => {
  // Constraint: 폼 참여(name·form·required)는 picker의 숨은 입력 하나가 맡음. 포털 안 월 달력이 같은 이름을 또 내지 않고, 닫혀 있어도 제출·reset이 됨 (계약 §3.5)
  // Constraint: 입력 칸이 없으므로 onBlur·onInvalidValue·ref·라벨은 늘 트리거 쪽이 맡음. 월 달력이 열릴 때마다 같은 오류를 또 알리지 않게 함
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
    onPick,
    onValueChange,
    open,
    placeholder,
    presentation = 'auto',
    ref,
    renderTrigger,
    required,
    value,
    ...calendarProps
  } = props;
  const settings = usePickerSettings(props);
  const resolvedPresentation = usePresentation(presentation);
  // Constraint: 기본값은 M3 입력 부품처럼 조용히 해석함. 해석할 수 없는 기본값은 빈 값으로 시작하고 onInvalidValue는 제어 값에만 불림
  const [currentValue, setCurrentValue] = useControllableState<string | null>(
    value,
    parseMonthValue(defaultValue ?? null).month,
    undefined,
  );
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const [mountedDefault] = useState(() => defaultValue ?? null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { labels } = settings.locale;
  const parsed = parseMonthValue(currentValue);
  const parsedMonth = parsed.month;
  // Constraint: 형식이 틀린 min·max는 제약으로 쓰지 않음 (MonthCalendar와 같음)
  const bounds: MonthBounds = {
    max: parseMonthValue(calendarProps.max ?? null).month,
    min: parseMonthValue(calendarProps.min ?? null).month,
  };
  const displayValue = formatDisplayMonth(parsedMonth, settings.locale);
  const toTriggerProps = useAppTriggerProps({
    isOpen,
    labelProps: {
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
    },
    onBlur,
  });

  const focusTrigger = (): void => {
    triggerRef.current?.focus();
  };
  useImperativeHandle(ref, () => ({ focus: focusTrigger }));
  useInvalidValueReport({
    calendarKey: MONTH_PARSE_KEY,
    input: currentValue || null,
    isEnabled: true,
    onInvalidValue,
    reason: parsed.invalidReason,
  });

  const changeValue = (next: MonthString | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 이미 고른 달을 다시 골라도 닫힘. onValueChange는 값이 바뀔 때만 오므로 고르기 신호로 닫음 (계약 §3.4 onPick)
  const closeOnPick = (picked: MonthString): void => {
    onPick?.(picked);
    setOpen(false);
  };

  // Goal: M3 입력 부품과 같은 reset 규칙. 비제어만 마운트 때 기본값으로 돌아가며 알리고, 제어 값은 부모가 정함 (계약 §3.3 #1)
  const resetToDefault = (): void => {
    if (value !== undefined) return;
    const restored = parseMonthValue(mountedDefault).month;
    if (restored === parsedMonth) return;
    setCurrentValue(restored);
    onValueChange?.(restored, { validity: monthValidityOf({ bounds, month: restored }) });
  };

  // Constraint: 빈 값은 VALID로 알림. 포커스를 먼저 옮겨, 값이 비며 사라지는 지우기 버튼과 함께 포커스가 body로 떨어지지 않게 함
  const clearValue = (): void => {
    focusTrigger();
    changeValue(null, { validity: VALID });
  };

  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement => {
    const appTriggerProps = toTriggerProps(triggerProps);
    return renderTrigger ? (
      renderTrigger({ displayValue, isOpen, placeholder: placeholder ?? '', triggerProps: appTriggerProps })
    ) : (
      <ValueTrigger
        triggerProps={appTriggerProps}
        label={ariaLabel ?? labels.chooseMonth}
        icon={<CalendarIcon />}
        placeholder={placeholder}
        text={displayValue}
      />
    );
  };

  const isVisiblyInvalid = calendarProps.invalid === true || !monthValidityOf({ bounds, month: parsedMonth }).isValid;
  const isClearShown =
    isClearable && parsedMonth !== null && calendarProps.disabled !== true && calendarProps.readOnly !== true;
  return (
    <div
      className={className}
      {...partAttributes('month-picker', { open: isOpen, invalid: isVisiblyInvalid, placeholder: displayValue === '' })}
    >
      <PickerSurface
        presentation={resolvedPresentation}
        isOpen={isOpen}
        isDisabled={calendarProps.disabled === true}
        isReadOnly={calendarProps.readOnly === true}
        onOpenChange={setOpen}
        label={ariaLabel ?? labels.chooseMonth}
        renderTrigger={renderPickerTrigger}
        triggerRef={triggerRef}
      >
        <MonthCalendar.Root {...calendarProps} value={currentValue} onValueChange={changeValue} onPick={closeOnPick} />
        {resolvedPresentation === 'sheet' ? <PickerCloseFooter label={labels.close} /> : null}
      </PickerSurface>
      {isClearShown ? <PickerClearButton label={labels.clear} onClear={clearValue} /> : null}
      <HiddenInput
        name={name}
        form={form}
        required={required}
        disabled={calendarProps.disabled}
        value={parsedMonth ?? ''}
        onFocusRequest={focusTrigger}
        onFormReset={resetToDefault}
      />
    </div>
  );
};

const formatDisplayMonth = (month: MonthString | null, locale: LocaleData): string => {
  if (month === null) return '';
  const parsed = parseMonth(month);
  if (!parsed.isOk) return '';
  return locale.formatHeading(
    { year: parsed.value.year, monthCode: toMonthCode(parsed.value.month, false) },
    gregory.id,
  );
};

// Constraint: 완전히 빈 값은 required여도 VALID로 알림. required는 네이티브 required 검증만 맡음 (M3 입력 부품과 같음)
const monthValidityOf = ({ bounds, month }: MonthValidityInput): Validity => {
  if (month === null) return VALID;
  if (bounds.min !== null && month < bounds.min) return invalidBecause(['before-min']);
  if (bounds.max !== null && month > bounds.max) return invalidBecause(['after-max']);
  return VALID;
};

const parseMonthValue = (value: string | null): ParsedMonthValue => {
  if (!value) return EMPTY_MONTH;
  const parsed = parseMonth(value);
  return parsed.isOk
    ? { invalidReason: null, month: parsed.value.value }
    : { invalidReason: parsed.error, month: null };
};
