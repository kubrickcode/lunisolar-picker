import { type CalendarSystem, type DateString, parseDate, type ValidationReason } from '@lunisolar-picker/calendar';
import { type DateConstraints, type LocaleLabels, VALID, type Validity, validateDate } from '@lunisolar-picker/core';
import { type ReactElement, type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  Calendar,
  type CellRenderInfo,
  DateField,
  HiddenInput,
  type PickerSettings,
  type Presentation,
  type UseCalendarProps,
  useControllableState,
  usePickerSettings,
  usePresentation,
  useSingleCalendar,
  type ValueChangeDetails,
} from '../index';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { formatDisplayDate } from './format-display-value';
import { PickerCloseFooter, PickerFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';

const FIELD_SELECTOR = `[${PART_ATTRIBUTE}="date-field"]`;

export interface DatePickerProps extends UseCalendarProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly footer?: ReactNode;
  readonly id?: string | undefined;
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

type InvalidValueReportInput = {
  readonly isEnabled: boolean;
  readonly onInvalidValue: ((input: string, reason: ValidationReason) => void) | undefined;
  readonly settings: PickerSettings;
  readonly value: string | null;
};

type SingleConfirmFooterProps = {
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onClose: () => void;
};

type ValidityInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly constraints: DateConstraints;
  readonly value: DateString | null;
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
    parseOptionalValue(defaultValue ?? null, settings.calendars),
    undefined,
  );
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const [mountedDefault] = useState(() => defaultValue ?? null);
  // Goal: reset 뒤 값이 그대로여도 입력 칸에 남은 미완성 입력을 지우려고 입력 칸을 새로 마운트함
  const [fieldResetCount, setFieldResetCount] = useState(0);
  const fieldRef = useRef<{ focus(): void } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const shouldRefocusFieldRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isPressingTriggerRef = useRef(false);
  const isConfirmMode = commitMode === 'confirm';
  const isTriggerMode = renderTrigger !== undefined;
  const { labels } = settings.locale;
  const parsedValue = parseOptionalValue(currentValue, settings.calendars);

  const focusInput = (): void => {
    if (isTriggerMode) triggerRef.current?.focus();
    else fieldRef.current?.focus();
  };
  useImperativeHandle(ref, () => ({ focus: focusInput }));
  useInvalidValueReport({ isEnabled: isTriggerMode, onInvalidValue, settings, value: currentValue });

  const changeValue = (next: DateString | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 이미 고른 날을 다시 골라도 닫힘. onValueChange는 값이 바뀔 때만 오므로 고르기 신호로 닫음 (계약 §3.4 onPick)
  const closeOnPick = (picked: DateString): void => {
    onPick?.(picked);
    if (!isConfirmMode) setOpen(false);
  };

  // Goal: 입력 칸을 새로 마운트해도 입력 중이던 사용자의 포커스를 잃지 않게 함
  // biome-ignore lint/correctness/useExhaustiveDependencies: 새로 마운트한 입력 칸에 포커스해야 하므로 reset 횟수가 바뀐 커밋 뒤에 돌아야 함
  useEffect(() => {
    if (!shouldRefocusFieldRef.current) return;
    // 의도적 변경: 다시 포커스할 요청은 한 번만 씀
    shouldRefocusFieldRef.current = false;
    fieldRef.current?.focus();
  }, [fieldResetCount]);

  // Goal: M3 입력 부품과 같은 reset 규칙. 비제어만 마운트 때 기본값(그 역법이 빠졌으면 빈 값)으로 돌아가며 알리고, 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 비교는 해석한 값끼리 함. 역법이 빠져 해석되지 않는 현재 값과 빈 기본값은 같은 빈 값이라 알리지 않음
  const resetToDefault = (): void => {
    if (value !== undefined) return;
    const restored = parseOptionalValue(mountedDefault, settings.calendars);
    const field = rootRef.current?.querySelector(FIELD_SELECTOR);
    // 의도적 변경: 다시 마운트한 뒤 포커스를 돌려줄지 렌더와 무관하게 기억함
    shouldRefocusFieldRef.current = field?.contains(document.activeElement) === true;
    setFieldResetCount((count) => count + 1);
    if (restored === parsedValue) return;
    setCurrentValue(restored);
    onValueChange?.(restored, {
      validity: validityOf({ calendars: settings.calendars, constraints: props, value: restored }),
    });
  };

  // Constraint: 팝오버 안으로 옮겨 가는 포커스는 picker를 떠난 것이 아니므로 닫혀 있을 때만 알림
  // Constraint: Safari는 누른 버튼에 포커스를 주지 않아 트리거를 누르는 순간 트리거가 blur됨. 여는 동작이라 떠남으로 보지 않음
  // Constraint: 누름 때문의 blur는 pointerdown 중에 일어나므로 누름이 끝나면 표시를 지워 이후의 진짜 떠남을 삼키지 않음
  const releaseTriggerPress = (): void => {
    // 의도적 변경: 렌더와 무관한 누름 표시
    isPressingTriggerRef.current = false;
  };

  const leaveTrigger = (): void => {
    const isPressing = isPressingTriggerRef.current;
    // 의도적 변경: 누름 표시는 한 번의 blur에만 씀
    isPressingTriggerRef.current = false;
    if (!isOpen && !isPressing) onBlur?.();
  };

  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement =>
    renderTrigger ? (
      renderTrigger({
        displayValue: formatDisplayDate(currentValue, settings, separator),
        isOpen,
        placeholder,
        triggerProps: {
          ...triggerProps,
          id,
          'aria-describedby': ariaDescribedBy,
          'aria-label': ariaLabel,
          'aria-labelledby': ariaLabelledBy,
          onBlur: leaveTrigger,
          onClick: (event) => {
            // 의도적 변경: 누름이 끝났으므로 다음 blur는 다시 떠남으로 봄
            isPressingTriggerRef.current = false;
            triggerProps.onClick?.(event);
          },
          onPointerCancel: releaseTriggerPress,
          onPointerDown: () => {
            // 의도적 변경: 렌더와 무관한 누름 표시
            isPressingTriggerRef.current = true;
          },
          onPointerUp: releaseTriggerPress,
        },
      })
    ) : (
      <DefaultTrigger triggerProps={triggerProps} label={labels.chooseDate} icon={<CalendarIcon />} />
    );

  const isVisiblyInvalid =
    sharedProps.invalid === true ||
    (parsedValue !== null && !validateDate(parsedValue, props, { calendars: settings.calendars }).isValid);
  return (
    <div
      ref={rootRef}
      className={className}
      {...partAttributes('date-picker', { open: isOpen, invalid: isVisiblyInvalid })}
    >
      {isTriggerMode ? null : (
        <DateField.Root
          key={fieldResetCount}
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
      <PickerSurface
        presentation={resolvedPresentation}
        isOpen={isOpen}
        isDisabled={sharedProps.disabled === true || sharedProps.readOnly === true}
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
          numberOfMonths={numberOfMonths}
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

// Goal: 입력 칸이 없는 앱 트리거에서도 해석할 수 없는 값을 입력 칸과 같은 규칙으로 값마다 한 번 알림. 달력을 열 때마다 다시 알리지 않음
const useInvalidValueReport = ({ isEnabled, onInvalidValue, settings, value }: InvalidValueReportInput): void => {
  const reportedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const parsed = isEnabled && value ? parseDate(value, { calendars: settings.calendars }) : null;
    if (parsed === null || parsed.isOk) {
      // 의도적 변경: 다시 같은 잘못된 값이 오면 새로 알리도록 기록을 지움
      reportedKeyRef.current = null;
      return;
    }
    const key = `${settings.calendarKey}|${value}`;
    if (reportedKeyRef.current === key) return;
    // 의도적 변경: 같은 값을 다시 알리지 않도록 렌더와 무관한 기록을 남김
    reportedKeyRef.current = key;
    if (value) onInvalidValue?.(value, parsed.error);
  }, [isEnabled, onInvalidValue, settings, value]);
};

const parseOptionalValue = (value: string | null, calendars: readonly CalendarSystem[]): DateString | null => {
  if (!value) return null;
  const parsed = parseDate(value, { calendars });
  return parsed.isOk ? parsed.value.value : null;
};

// Constraint: 완전히 빈 값은 required여도 VALID로 알림. required는 aria-required와 네이티브 required 검증만 맡음 (M3 입력 부품과 같음)
const validityOf = ({ calendars, constraints, value }: ValidityInput): Validity => {
  if (value === null) return VALID;
  const { isValid, reasons } = validateDate(value, constraints, { calendars });
  return { isValid, reasons };
};
