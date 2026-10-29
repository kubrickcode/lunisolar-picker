import type { DateString } from '@lunisolar-picker/calendar';
import { type LocaleLabels, VALID, validateDate } from '@lunisolar-picker/core';
import { type ReactElement, type ReactNode, type Ref, useImperativeHandle, useRef, useState } from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  Calendar,
  type CellRenderInfo,
  DateField,
  HiddenInput,
  type Presentation,
  type UseCalendarProps,
  useControllableState,
  usePickerSettings,
  usePresentation,
  useSingleCalendar,
  type ValueChangeDetails,
} from '../index';
import { dateValidityOf, moveDateOffRemovedCalendar, parseDateValue, useValueOnProvidedCalendars } from './date-value';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { formatDisplayDate } from './format-display-value';
import { PickerClearButton } from './picker-clear-button';
import { PickerCloseFooter, PickerFooter } from './picker-footer';
import { monthCountForSurface, PickerSurface } from './picker-surface';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';
import { useFieldRemount } from './use-field-remount';
import { useInvalidValueReport } from './use-invalid-value-report';

const FIELD_SELECTOR = `[${PART_ATTRIBUTE}="date-field"]`;

export interface DatePickerProps extends UseCalendarProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly footer?: ReactNode;
  readonly id?: string | undefined;
  // Goal: 값이 있고 비활성·읽기 전용이 아니면 입력 칸(앱 트리거를 쓰면 트리거) 옆에 지우기 버튼을 보임. false면 그리지 않음 (스펙 2 clearable)
  readonly isClearable?: boolean | undefined;
  readonly placeholder?: string | undefined;
  readonly presentation?: Presentation | undefined;
  // Goal: ref.focus()가 입력 칸의 첫 칸(앱 트리거를 쓰면 그 트리거)에 포커스함. react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀 (스펙 7.6, preflight 3.7)
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderCell?: ((info: CellRenderInfo) => ReactNode) | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
  readonly separator?: string | undefined;
}

export interface PickerOpenProps {
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((isOpen: boolean) => void) | undefined;
  readonly open?: boolean | undefined;
}

type SingleConfirmFooterProps = {
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onClose: () => void;
};

export const DatePicker = (props: DatePickerProps): ReactElement => {
  // Constraint: 폼 참여(name·form)는 picker의 숨은 입력 하나가 맡음. 입력 칸이 없는 앱 트리거에서도 제출·reset·required가 같게 동작하고, 포털 안 달력이 같은 이름을 또 내지 않음 (preflight 1.6)
  // Constraint: onBlur·onInvalidValue·ref·라벨은 입력 칸(앱 트리거를 쓰면 트리거 쪽)만 받음. 달력이 열릴 때마다 같은 오류를 또 알리지 않게 함 (계약 §3.5)
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    commitMode,
    defaultDisplayCalendar,
    defaultOpen,
    defaultValue,
    displayCalendar,
    footer,
    form,
    getCellLabel,
    id,
    isClearable = true,
    name,
    numberOfMonths,
    onBlur,
    onDisplayCalendarChange,
    onInvalidValue,
    onOpenChange,
    onPick,
    onValueChange,
    open,
    placeholder = '',
    presentation = 'auto',
    ref,
    renderCell,
    renderTrigger,
    required,
    separator,
    value,
    ...sharedProps
  } = props;
  const settings = usePickerSettings(props);
  const resolvedPresentation = usePresentation(presentation);
  // Constraint: 기본값은 M3 입력 부품처럼 조용히 해석함. 해석할 수 없는 기본값은 빈 값으로 시작하고 onInvalidValue는 제어 값에만 불림
  const [currentValue, setCurrentValue] = useControllableState<string | null>(
    value,
    parseDateValue(defaultValue ?? null, settings.calendars).value,
    undefined,
  );
  useValueOnProvidedCalendars({
    isControlled: value !== undefined,
    moveValue: (current, previousCalendars) =>
      moveDateOffRemovedCalendar({ calendars: settings.calendars, previousCalendars, value: current }),
    settings,
    setValue: setCurrentValue,
    value: currentValue,
  });
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const [mountedDefault] = useState(() => defaultValue ?? null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { fieldKey, fieldRef, remountField } = useFieldRemount({ fieldSelector: FIELD_SELECTOR, rootRef });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isConfirmMode = commitMode === 'confirm';
  const isTriggerMode = renderTrigger !== undefined;
  const { labels } = settings.locale;
  const parsed = parseDateValue(currentValue, settings.calendars);
  const parsedValue = parsed.value;
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
    calendarKey: settings.calendarKey,
    input: currentValue || null,
    isEnabled: isTriggerMode,
    onInvalidValue,
    reason: parsed.invalidReason,
  });

  const changeValue = (next: DateString | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 이미 고른 날을 다시 골라도 닫힘. onValueChange는 값이 바뀔 때만 오므로 고르기 신호로 닫음 (계약 §3.4 onPick)
  const closeOnPick = (picked: DateString): void => {
    onPick?.(picked);
    if (!isConfirmMode) setOpen(false);
  };

  // Goal: M3 입력 부품과 같은 reset 규칙. 비제어만 마운트 때 기본값(그 역법이 빠졌으면 빈 값)으로 돌아가며 알리고, 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 비교는 해석한 값끼리 함. 역법이 빠져 해석되지 않는 현재 값과 빈 기본값은 같은 빈 값이라 알리지 않음
  const resetToDefault = (): void => {
    if (value !== undefined) return;
    const restored = parseDateValue(mountedDefault, settings.calendars).value;
    remountField();
    if (restored === parsedValue) return;
    setCurrentValue(restored);
    onValueChange?.(restored, {
      validity: dateValidityOf({ calendars: settings.calendars, constraints: props, value: restored }),
    });
  };

  // Constraint: 빈 값은 VALID로 알림. 포커스를 먼저 옮겨, 값이 비며 사라지는 지우기 버튼과 함께 포커스가 body로 떨어지지 않게 함
  const clearValue = (): void => {
    focusInput();
    changeValue(null, { validity: VALID });
  };

  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement =>
    renderTrigger ? (
      renderTrigger({
        displayValue: formatDisplayDate(currentValue, settings, separator),
        isOpen,
        placeholder,
        triggerProps: toAppTriggerProps(triggerProps),
      })
    ) : (
      <DefaultTrigger triggerProps={triggerProps} label={labels.chooseDate} icon={<CalendarIcon />} />
    );

  const isVisiblyInvalid =
    sharedProps.invalid === true ||
    (parsedValue !== null && !validateDate(parsedValue, props, { calendars: settings.calendars }).isValid);
  const isClearShown =
    isClearable && parsedValue !== null && sharedProps.disabled !== true && sharedProps.readOnly !== true;
  const clearButton = isClearShown ? <PickerClearButton label={labels.clear} onClear={clearValue} /> : null;
  return (
    <div
      ref={rootRef}
      className={className}
      {...partAttributes('date-picker', { open: isOpen, invalid: isVisiblyInvalid })}
    >
      {isTriggerMode ? null : (
        <DateField.Root
          key={fieldKey}
          {...sharedProps}
          ref={fieldRef}
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          required={required}
          onBlur={onBlur}
          onInvalidValue={onInvalidValue}
          separator={separator}
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
        label={ariaLabel ?? labels.chooseDate}
        renderTrigger={renderPickerTrigger}
        triggerRef={triggerRef}
      >
        <Calendar.Root
          {...sharedProps}
          commitMode={commitMode}
          defaultDisplayCalendar={defaultDisplayCalendar}
          displayCalendar={displayCalendar}
          getCellLabel={getCellLabel}
          numberOfMonths={monthCountForSurface(resolvedPresentation, numberOfMonths)}
          onDisplayCalendarChange={onDisplayCalendarChange}
          value={currentValue}
          onValueChange={changeValue}
          onPick={closeOnPick}
        >
          <Calendar.Layout renderCell={renderCell} />
          {footer}
          {isConfirmMode ? <SingleConfirmFooter labels={labels} onClose={() => setOpen(false)} /> : null}
          {!isConfirmMode && resolvedPresentation === 'sheet' ? <PickerCloseFooter label={labels.close} /> : null}
        </Calendar.Root>
      </PickerSurface>
      {isTriggerMode ? clearButton : null}
      <HiddenInput
        name={name}
        form={form}
        required={required}
        disabled={sharedProps.disabled}
        value={parsedValue ?? ''}
        onFocusRequest={focusInput}
        onFormReset={resetToDefault}
      />
    </div>
  );
};

// Constraint: commit()은 호출 시점에 onValueChange를 부르므로 같은 클릭에서 닫혀 달력이 언마운트돼도 확정 값이 전달됨 (preflight 1.4)
const SingleConfirmFooter = ({ labels, onClose }: SingleConfirmFooterProps): ReactElement => {
  const calendar = useSingleCalendar();
  return (
    <PickerFooter
      labels={labels}
      isConfirmDisabled={calendar.selection.draft === null}
      onCancel={onClose}
      onConfirm={() => {
        calendar.commit();
        onClose();
      }}
    />
  );
};
