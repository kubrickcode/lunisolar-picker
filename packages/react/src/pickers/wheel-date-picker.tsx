import { type CalendarSystem, calendarIdOf, type DateString, epochDayOf, formatDate } from '@lunisolar-picker/calendar';
import {
  boundsFor,
  clampEpochDay,
  type DateConstraints,
  epochDayOfFields,
  findCalendar,
  type LocaleLabels,
  resolveConstraints,
  VALID,
} from '@lunisolar-picker/core';
import { type ReactElement, type Ref, useImperativeHandle, useRef, useState } from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  HiddenInput,
  type UseWheelDateProps,
  useControllableState,
  usePickerSettings,
  useWheelDate,
  type ValueChangeDetails,
  Wheel,
  type WheelDateApi,
} from '../index';
import type { PickerOpenProps } from './date-picker';
import { dateValidityOf, moveDateOffRemovedCalendar, parseDateValue, useValueOnProvidedCalendars } from './date-value';
import { CalendarIcon, ValueTrigger } from './default-trigger';
import { formatDisplayDate } from './format-display-value';
import { PickerClearButton } from './picker-clear-button';
import { PickerFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';
import { useFieldRemount } from './use-field-remount';
import { useInvalidValueReport } from './use-invalid-value-report';

const WHEEL_SELECTOR = `[${PART_ATTRIBUTE}="wheel"]`;

type DraftStartInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly constraints: DateConstraints;
  readonly value: DateString | null;
};

type InlineWheelProps = {
  readonly labelProps: WheelLabelProps;
  readonly ref: Ref<{ focus(): void }>;
  readonly wheelProps: UseWheelDateProps;
};

type SheetWheelDraftProps = {
  readonly initialValue: DateString | null;
  readonly label: string;
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onCancel: () => void;
  readonly onConfirm: (shownValue: DateString) => void;
  readonly wheelProps: UseWheelDateProps;
};

type WheelColumnsProps = {
  readonly labelProps: WheelLabelProps;
  readonly wheel: WheelDateApi;
};

export interface WheelDatePickerProps extends UseWheelDateProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  // Goal: 값이 있고 비활성·읽기 전용이 아니면 휠(시트면 트리거) 옆에 지우기 버튼을 보임. false면 그리지 않음 (스펙 2 clearable)
  readonly isClearable?: boolean | undefined;
  readonly placeholder?: string | undefined;
  // Goal: 생년월일처럼 휠을 화면에 바로 두거나(inline), 모바일에서 시트로 열어 확인을 눌러 반영함(sheet)
  readonly presentation?: 'inline' | 'sheet' | undefined;
  // Goal: ref.focus()가 휠의 첫 열(시트면 트리거)에 포커스함. react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀 (스펙 7.6, preflight 3.7)
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
  readonly separator?: string | undefined;
}

type WheelLabelProps = {
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-label': string;
  readonly 'aria-labelledby': string | undefined;
  readonly id: string | undefined;
};

export const WheelDatePicker = (props: WheelDatePickerProps): ReactElement => {
  // Constraint: 폼 참여(name·form·required)는 picker의 숨은 입력 하나가 맡고 Wheel.HiddenInput은 그리지 않음. 시트의 휠은 닫히면 언마운트되어 그 입력도 사라지고, picker가 휠을 제어하므로 휠 쪽 reset은 무시되기 때문 (계약 §3.5)
  // Constraint: onBlur·onInvalidValue·ref·라벨은 inline이면 휠이, 시트면 트리거가 맡음. 시트가 열릴 때마다 같은 오류를 또 알리지 않게 함
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
    placeholder = '',
    presentation = 'inline',
    ref,
    renderTrigger,
    required,
    separator,
    value,
    ...wheelProps
  } = props;
  const settings = usePickerSettings(props);
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
  const { fieldKey, fieldRef, remountField } = useFieldRemount({ fieldSelector: WHEEL_SELECTOR, rootRef });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isSheet = presentation === 'sheet';
  const { labels } = settings.locale;
  const parsed = parseDateValue(currentValue, settings.calendars);
  const parsedValue = parsed.value;
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
    calendarKey: settings.calendarKey,
    input: currentValue || null,
    isEnabled: isSheet,
    onInvalidValue,
    reason: parsed.invalidReason,
  });

  const changeValue = (next: DateString | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 확인은 시트에 보이는 날을 확정함. 굴리지 않았어도 보이는 날(값이 없으면 오늘, 제약 밖 값이면 잘린 날)이 지금 값과 다르면 알림 (계약 §3.3 #8, preflight 2.16)
  const confirmShownValue = (shownValue: DateString): void => {
    if (shownValue !== parsedValue) {
      changeValue(shownValue, {
        validity: dateValidityOf({ calendars: settings.calendars, constraints: props, value: shownValue }),
      });
    }
    setOpen(false);
  };

  // Goal: M3 입력 부품과 같은 reset 규칙. 비제어만 마운트 때 기본값(그 역법이 빠졌으면 빈 값)으로 돌아가며 알리고, 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 휠은 값이 비어도 보이던 날에 머물므로 다시 마운트해 빈 기본값이면 오늘을 보이게 함
  const resetToDefault = (): void => {
    if (value !== undefined) return;
    const restored = parseDateValue(mountedDefault, settings.calendars).value;
    // Constraint: 시트에는 다시 마운트할 입력 자리가 없음. 시트의 휠은 열 때마다 새로 마운트됨
    if (!isSheet) remountField();
    if (restored === parsedValue) return;
    setCurrentValue(restored);
    onValueChange?.(restored, {
      validity: dateValidityOf({ calendars: settings.calendars, constraints: props, value: restored }),
    });
  };

  // Constraint: 빈 값은 VALID로 알림. 포커스를 먼저 옮겨, 값이 비며 사라지는 지우기 버튼과 함께 포커스가 body로 떨어지지 않게 함
  // Constraint: 휠은 값이 비어도 보이던 날에 머물므로 form reset처럼 다시 마운트해 오늘을 보이고, 새 휠의 첫 열로 포커스함
  const clearValue = (): void => {
    if (isSheet) focusInput();
    else remountField({ shouldFocusField: true });
    changeValue(null, { validity: VALID });
  };

  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement => {
    const appTriggerProps = toAppTriggerProps(triggerProps);
    const displayValue = formatDisplayDate(currentValue, settings, separator);
    return renderTrigger ? (
      renderTrigger({ displayValue, isOpen, placeholder, triggerProps: appTriggerProps })
    ) : (
      <ValueTrigger
        triggerProps={appTriggerProps}
        label={ariaLabel ?? labels.chooseDate}
        icon={<CalendarIcon />}
        text={displayValue || placeholder}
      />
    );
  };

  const isVisiblyInvalid =
    wheelProps.invalid === true ||
    !dateValidityOf({ calendars: settings.calendars, constraints: props, value: parsedValue }).isValid;
  const isClearShown =
    isClearable && parsedValue !== null && wheelProps.disabled !== true && wheelProps.readOnly !== true;
  return (
    <div
      ref={rootRef}
      className={className}
      {...partAttributes('wheel-date-picker', {
        open: isSheet && isOpen,
        invalid: isVisiblyInvalid,
        placeholder: isSheet && parsedValue === null,
      })}
    >
      {isSheet ? (
        <PickerSurface
          presentation="sheet"
          isOpen={isOpen}
          isDisabled={wheelProps.disabled === true}
          isReadOnly={wheelProps.readOnly === true}
          onOpenChange={setOpen}
          label={ariaLabel ?? labels.chooseDate}
          renderTrigger={renderPickerTrigger}
          triggerRef={triggerRef}
        >
          <SheetWheelDraft
            initialValue={parsedValue}
            label={labels.chooseDate}
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
          labelProps={{ ...labelProps, 'aria-label': ariaLabel ?? labels.chooseDate }}
          wheelProps={{ ...wheelProps, onBlur, onInvalidValue, value: currentValue, onValueChange: changeValue }}
        />
      )}
      {isClearShown ? <PickerClearButton label={labels.clear} onClear={clearValue} /> : null}
      <HiddenInput
        name={name}
        form={form}
        required={required}
        disabled={wheelProps.disabled}
        value={parsedValue ?? ''}
        onFocusRequest={focusInput}
        onFormReset={resetToDefault}
      />
    </div>
  );
};

const InlineWheel = ({ labelProps, ref, wheelProps }: InlineWheelProps): ReactElement => {
  const wheel = useWheelDate(wheelProps);
  useImperativeHandle(ref, () => ({ focus: wheel.focus }), [wheel.focus]);
  return <WheelColumns wheel={wheel} labelProps={labelProps} />;
};

// Goal: 시트 안 휠은 굴리는 동안 값을 바꾸지 않고 확인을 눌러야 반영함. 시트가 닫히면 언마운트되어 임시 값도 버려짐
const SheetWheelDraft = ({
  initialValue,
  label,
  labels,
  onCancel,
  onConfirm,
  wheelProps,
}: SheetWheelDraftProps): ReactElement => {
  const settings = usePickerSettings(wheelProps);
  // Constraint: 휠은 제약 밖 값을 잘라 보여도 원래 값으로 무효를 알리므로, 확인이 확정할 잘린 날에서 시작해 보이는 날과 무효 표시를 맞춤
  const wheel = useWheelDate({
    ...wheelProps,
    defaultValue: draftStartOf({ calendars: settings.calendars, constraints: wheelProps, value: initialValue }),
  });
  const shownValue = shownValueOf(wheel, settings.calendars);
  const isConfirmable =
    shownValue !== null &&
    dateValidityOf({ calendars: settings.calendars, constraints: wheelProps, value: shownValue }).isValid;
  return (
    <>
      <WheelColumns
        wheel={wheel}
        labelProps={{ id: undefined, 'aria-describedby': undefined, 'aria-label': label, 'aria-labelledby': undefined }}
      />
      <PickerFooter
        labels={labels}
        isConfirmDisabled={!isConfirmable}
        onCancel={onCancel}
        onConfirm={() => {
          // Constraint: 보이는 날을 적을 수 없으면 확인이 비활성이라 닿지 않음. 타입을 좁히려는 방어 검사
          if (shownValue !== null) onConfirm(shownValue);
        }}
      />
    </>
  );
};

const WheelColumns = ({ labelProps, wheel }: WheelColumnsProps): ReactElement => (
  <Wheel.Root {...wheel.getWheelRootProps()} {...labelProps}>
    <Wheel.Column
      options={wheel.columns.years}
      value={wheel.fields.year}
      onValueChange={wheel.selectYear}
      label={wheel.labels.year}
    />
    <Wheel.Column
      options={wheel.columns.months}
      value={wheel.fields.monthCode}
      onValueChange={wheel.selectMonth}
      label={wheel.labels.month}
    />
    <Wheel.Column
      options={wheel.columns.days}
      value={wheel.fields.day}
      onValueChange={wheel.selectDay}
      label={wheel.labels.day}
    />
    <Wheel.Highlight />
  </Wheel.Root>
);

// Goal: 확인이 확정할 날. 제약 밖 값은 제약 범위로 자르고, 고를 날이 없거나 자른 날을 적을 수 없으면 원래 값을 둠
const draftStartOf = ({ calendars, constraints, value }: DraftStartInput): DateString | null => {
  if (value === null) return null;
  const calendar = findCalendar(calendars, calendarIdOf(value));
  const bounds = boundsFor(calendar, resolveConstraints(constraints, calendar, calendars));
  if (bounds.min > bounds.max) return value;
  const formatted = formatDate(clampEpochDay(epochDayOf(value), bounds), calendar);
  return formatted.isOk ? formatted.value : value;
};

// Constraint: 휠의 value는 고른 적이 없으면 null이고 제약 밖 부모 값이면 잘리기 전 값이라, 확인은 늘 보이는 칸(fields)으로 날을 정함
const shownValueOf = (wheel: WheelDateApi, calendars: readonly CalendarSystem[]): DateString | null => {
  const calendar = findCalendar(calendars, wheel.entryCalendarId);
  const formatted = formatDate(epochDayOfFields(calendar, wheel.fields), calendar);
  return formatted.isOk ? formatted.value : null;
};
