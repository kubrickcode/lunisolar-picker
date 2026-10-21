import {
  type CalendarSystem,
  type DateRangeValue,
  isSameRange,
  normalizeDateRange,
  parseDate,
  type ValidationReason,
} from '@lunisolar-picker/calendar';
import { type LocaleLabels, type RangeConstraints, VALID, type Validity, validateRange } from '@lunisolar-picker/core';
import { type ReactElement, type ReactNode, type Ref, useImperativeHandle, useRef, useState } from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  Calendar,
  type CellRenderInfo,
  DateRangeField,
  type DateRangeInput,
  HiddenInput,
  type Presentation,
  RangeCalendar,
  type RangeSide,
  type UseRangeCalendarProps,
  useControllableState,
  usePickerSettings,
  usePresentation,
  useRangeCalendarContext,
  type ValueChangeDetails,
} from '../index';
import type { PickerOpenProps } from './date-picker';
import { moveDateOffRemovedCalendar, useValueOnProvidedCalendars } from './date-value';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { formatDisplayRange } from './format-display-value';
import { PickerClearButton } from './picker-clear-button';
import { PickerCloseFooter, PickerFooter } from './picker-footer';
import { type PickerSelection, PickerSelectionContext } from './picker-selection';
import { monthCountForSurface, PickerSurface } from './picker-surface';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';
import { useFieldRemount } from './use-field-remount';
import { useInvalidValueReport } from './use-invalid-value-report';

const EMPTY_RANGE: ParsedRange = { invalidReason: null, value: null };
const FIELD_SELECTOR = `[${PART_ATTRIBUTE}="date-range-field"]`;
const SEGMENT_SELECTOR = `[${PART_ATTRIBUTE}="date-field-segment"]`;
const SIDE_SELECTOR = `[${PART_ATTRIBUTE}="date-field"]`;

export interface DateRangePickerProps extends UseRangeCalendarProps, PickerOpenProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly footer?: ReactNode;
  readonly id?: string | undefined;
  // Goal: 값이 있고 비활성·읽기 전용이 아니면 입력 칸(앱 트리거를 쓰면 트리거) 옆에 지우기 버튼을 보임. 누르면 양 끝을 함께 비움. false면 그리지 않음 (스펙 2 clearable)
  readonly isClearable?: boolean | undefined;
  readonly placeholder?: string | undefined;
  readonly presentation?: Presentation | undefined;
  // Goal: '최근 7일' 같은 프리셋 버튼은 앱이 그리고, 안에서 usePickerSelection으로 범위를 넣음 (스펙 2.2)
  readonly presets?: ReactNode;
  // Goal: ref.focus()가 시작일 입력 칸의 첫 칸(앱 트리거를 쓰면 그 트리거)에 포커스함. react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀 (스펙 7.6, preflight 3.7)
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderCell?: ((info: CellRenderInfo) => ReactNode) | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
  readonly separator?: string | undefined;
}

type ParsedRange = {
  readonly invalidReason: ValidationReason | null;
  readonly value: DateRangeValue | null;
};

type RangeConfirmFooterProps = {
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onClose: () => void;
};

type RangeMoveInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly previousCalendars: readonly CalendarSystem[];
  readonly range: DateRangeInput | null;
};

type SelectionBridgeProps = {
  readonly children: ReactNode;
  readonly isConfirmMode: boolean;
  readonly onClose: () => void;
  readonly onInvalidValue: ((input: string, reason: ValidationReason) => void) | undefined;
};

type ValidityInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly constraints: RangeConstraints;
  readonly value: DateRangeValue | null;
};

export const DateRangePicker = (props: DateRangePickerProps): ReactElement => {
  // Constraint: 폼 참여(startName·endName·form)는 picker의 숨은 입력 두 개가 맡음. 입력 칸이 없는 앱 트리거에서도 제출·reset·required가 같게 동작하고, 포털 안 달력이 같은 이름을 또 내지 않음 (preflight 1.6)
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
    endName,
    footer,
    form,
    getCellLabel,
    id,
    isClearable = true,
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
    presets,
    ref,
    renderCell,
    renderTrigger,
    required,
    separator,
    startName,
    value,
    ...sharedProps
  } = props;
  const settings = usePickerSettings(props);
  const resolvedPresentation = usePresentation(presentation);
  // Constraint: 기본값은 M3 입력 부품처럼 조용히 해석함. 해석할 수 없는 기본값은 빈 값으로 시작하고 onInvalidValue는 제어 값에만 불림
  const [currentValue, setCurrentValue] = useControllableState<DateRangeInput | null>(
    value,
    parseRange(defaultValue ?? null, settings.calendars).value,
    undefined,
  );
  useValueOnProvidedCalendars({
    isControlled: value !== undefined,
    moveValue: (current, previousCalendars) =>
      moveRangeOffRemovedCalendar({ calendars: settings.calendars, previousCalendars, range: current }),
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
  const isOpenEndAllowed = sharedProps.isOpenEndAllowed === true;
  const isTriggerMode = renderTrigger !== undefined;
  const { labels } = settings.locale;
  const parsed = parseRange(currentValue, settings.calendars);
  const parsedValue = parsed.value;
  // Goal: 폼에 내는 값. 열린 끝이 허용되지 않으면 반쪽 범위는 입력 칸처럼 값 없음으로 둠 (M3 DateRangeField와 같음)
  const publicValue = publicRangeOf(parsedValue, isOpenEndAllowed);
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

  // Constraint: 입력 칸의 ref는 시작일에만 포커스하므로 종료일 검증 포커스는 종료일 쪽 첫 칸을 직접 찾음
  const focusSide = (side: RangeSide): void => {
    if (isTriggerMode) {
      triggerRef.current?.focus();
      return;
    }
    if (side === 'start') {
      fieldRef.current?.focus();
      return;
    }
    const endSegment = rootRef.current?.querySelectorAll(SIDE_SELECTOR)[1]?.querySelector(SEGMENT_SELECTOR);
    if (endSegment instanceof HTMLElement) endSegment.focus();
  };
  useImperativeHandle(ref, () => ({ focus: () => focusSide('start') }));
  useInvalidValueReport({
    calendarKey: settings.calendarKey,
    input: currentValue === null ? null : describeRange(currentValue),
    isEnabled: isTriggerMode,
    onInvalidValue,
    reason: parsed.invalidReason,
  });

  const changeValue = (next: DateRangeValue | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 이미 고른 범위를 다시 골라도 닫힘. onValueChange는 값이 바뀔 때만 오므로 범위를 끝낸 신호로 닫음 (계약 §3.4 onPick)
  const closeOnPick = (picked: DateRangeValue): void => {
    onPick?.(picked);
    if (!isConfirmMode) setOpen(false);
  };

  // Goal: M3 입력 부품과 같은 reset 규칙. 비제어만 마운트 때 기본값(그 역법이 빠졌으면 빈 값)으로 돌아가며 알리고, 제어 값은 부모가 정함 (계약 §3.3 #1)
  // Constraint: 화면 값은 해석한 범위끼리, 알림은 폼에 내는 값끼리 비교함. 반쪽 범위끼리 바뀌어도 폼 값은 그대로 비어 있어 알리지 않음
  const resetToDefault = (): void => {
    if (value !== undefined) return;
    const restored = parseRange(mountedDefault, settings.calendars).value;
    remountField();
    if (isSameRange(restored, parsedValue)) return;
    setCurrentValue(restored);
    const restoredPublic = publicRangeOf(restored, isOpenEndAllowed);
    if (isSameRange(restoredPublic, publicValue)) return;
    onValueChange?.(restoredPublic, {
      validity: validityOf({ calendars: settings.calendars, constraints: props, value: restoredPublic }),
    });
  };

  // Constraint: 빈 값은 VALID로 알림. 포커스를 먼저 옮겨, 값이 비며 사라지는 지우기 버튼과 함께 포커스가 body로 떨어지지 않게 함
  const clearValue = (): void => {
    focusSide('start');
    changeValue(null, { validity: VALID });
  };

  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement =>
    renderTrigger ? (
      renderTrigger({
        displayValue: formatDisplayRange(currentValue, settings, separator),
        isOpen,
        placeholder,
        triggerProps: toAppTriggerProps(triggerProps),
      })
    ) : (
      <DefaultTrigger triggerProps={triggerProps} label={labels.chooseDateRange} icon={<CalendarIcon />} />
    );

  const isVisiblyInvalid =
    sharedProps.invalid === true ||
    (publicValue !== null && !validateRange(publicValue, props, { calendars: settings.calendars }).isValid);
  // Constraint: 열린 끝이 허용되지 않은 반쪽 범위도 입력 칸에 보이므로 지울 수 있게 보이는 범위로 판단함
  const isClearShown =
    isClearable && parsedValue !== null && sharedProps.disabled !== true && sharedProps.readOnly !== true;
  const clearButton = isClearShown ? <PickerClearButton label={labels.clear} onClear={clearValue} /> : null;
  return (
    <div
      ref={rootRef}
      className={className}
      {...partAttributes('date-range-picker', { open: isOpen, invalid: isVisiblyInvalid })}
    >
      {isTriggerMode ? null : (
        <DateRangeField.Root
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
        label={ariaLabel ?? labels.chooseDateRange}
        renderTrigger={renderPickerTrigger}
        triggerRef={triggerRef}
      >
        <RangeCalendar.Root
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
          <SelectionBridge isConfirmMode={isConfirmMode} onClose={() => setOpen(false)} onInvalidValue={onInvalidValue}>
            {presets ? <div {...partAttributes('picker-presets')}>{presets}</div> : null}
            <Calendar.Layout renderCell={renderCell} />
            {footer}
            {isConfirmMode ? <RangeConfirmFooter labels={labels} onClose={() => setOpen(false)} /> : null}
            {!isConfirmMode && resolvedPresentation === 'sheet' ? <PickerCloseFooter label={labels.close} /> : null}
          </SelectionBridge>
        </RangeCalendar.Root>
      </PickerSurface>
      {isTriggerMode ? clearButton : null}
      {/* Constraint: 두 입력은 같은 form에 속하므로 reset은 그려지는 첫 입력 하나만 받아 한 번만 알림 */}
      <HiddenInput
        name={startName}
        form={form}
        required={required}
        disabled={sharedProps.disabled}
        value={publicValue?.start ?? ''}
        onFocusRequest={() => focusSide('start')}
        onFormReset={startName === undefined ? undefined : resetToDefault}
      />
      <HiddenInput
        name={endName}
        form={form}
        // Constraint: 열린 끝이 허용되면 종료일은 선택 입력 (DateRangeField와 같음)
        required={required === true && !isOpenEndAllowed}
        disabled={sharedProps.disabled}
        value={publicValue?.end ?? ''}
        onFocusRequest={() => focusSide('end')}
        onFormReset={startName === undefined ? resetToDefault : undefined}
      />
    </div>
  );
};

// Constraint: commit()은 호출 시점에 onValueChange를 부르므로 같은 클릭에서 닫혀 달력이 언마운트돼도 확정 값이 전달됨 (preflight 1.4)
// Constraint: 열린 끝이 허용되면 시작일만 고른 범위도 유효해 확정할 수 있으므로 보이는 범위의 유효성만 봄 (core committableDraft와 같음)
const RangeConfirmFooter = ({ labels, onClose }: RangeConfirmFooterProps): ReactElement => {
  const range = useRangeCalendarContext();
  return (
    <PickerFooter
      labels={labels}
      isConfirmDisabled={!range.validity.isValid}
      onCancel={onClose}
      onConfirm={() => {
        range.commit();
        onClose();
      }}
    />
  );
};

// Goal: presets·footer 슬롯이 범위 달력을 picker 규칙(확정·취소하면 닫힘)대로 다루게 함
const SelectionBridge = ({ children, isConfirmMode, onClose, onInvalidValue }: SelectionBridgeProps): ReactElement => {
  const range = useRangeCalendarContext();
  // Constraint: 범위 달력처럼 비활성·읽기 전용이면 프리셋도 무시함. picker는 이때 표면을 보이지 않아 닿지 않지만, 슬롯이 범위 달력의 상태를 직접 지키도록 방어로 둠. 읽지 못한 프리셋은 앱 실수이므로 picker의 onInvalidValue로 알림 (달력에는 onInvalidValue를 넘기지 않음)
  // Goal: 즉시 모드에서 양 끝이 있는 프리셋은 범위를 끝까지 고른 것과 같으므로 닫음. 같은 범위를 다시 넣어도 닫힘
  const setRange = (next: DateRangeInput | null): void => {
    if (range.isDisabled || range.isReadOnly) return;
    const parsedRange = parseRange(next, range.context.calendars);
    if (next !== null && parsedRange.invalidReason !== null) {
      onInvalidValue?.(describeRange(next), parsedRange.invalidReason);
      return;
    }
    range.setRange(next);
    if (!isConfirmMode && parsedRange.value?.end != null) onClose();
  };
  const selection: PickerSelection = {
    cancel: () => {
      range.cancel();
      onClose();
    },
    commit: () => {
      range.commit();
      onClose();
    },
    draftRange: range.draftValue,
    setRange,
    validity: range.validity,
  };
  return <PickerSelectionContext value={selection}>{children}</PickerSelectionContext>;
};

// Constraint: M3 범위 부품이 onInvalidValue에 넘기는 모양과 같음
const describeRange = (input: DateRangeInput): string => `${input.start}/${input.end ?? ''}`;

// Constraint: 범위의 두 끝은 같은 역법이라 따로 옮겨도 같은 양력 범위가 됨. 바뀐 게 없으면 같은 참조를 돌려줘 다시 렌더하지 않음
const moveRangeOffRemovedCalendar = ({
  calendars,
  previousCalendars,
  range,
}: RangeMoveInput): DateRangeInput | null => {
  if (range === null) return null;
  const start = moveDateOffRemovedCalendar({ calendars, previousCalendars, value: range.start }) ?? range.start;
  const end = moveDateOffRemovedCalendar({ calendars, previousCalendars, value: range.end });
  return start === range.start && end === range.end ? range : { start, end };
};

const parseRange = (input: DateRangeInput | null, calendars: readonly CalendarSystem[]): ParsedRange => {
  if (input === null) return EMPTY_RANGE;
  if (!input.start) return { invalidReason: 'incomplete', value: null };
  const start = parseDate(input.start, { calendars });
  if (!start.isOk) return { invalidReason: start.error, value: null };
  const end = input.end ? parseDate(input.end, { calendars }) : null;
  if (end !== null && !end.isOk) return { invalidReason: end.error, value: null };
  const normalized = normalizeDateRange(start.value.value, end === null ? null : end.value.value);
  return normalized.isOk
    ? { invalidReason: null, value: normalized.value }
    : { invalidReason: normalized.error, value: null };
};

const publicRangeOf = (range: DateRangeValue | null, isOpenEndAllowed: boolean): DateRangeValue | null =>
  range === null || (range.end === null && !isOpenEndAllowed) ? null : range;

// Constraint: 완전히 빈 값은 required여도 VALID로 알림. required는 aria-required와 네이티브 required 검증만 맡음 (M3 입력 부품과 같음)
const validityOf = ({ calendars, constraints, value }: ValidityInput): Validity => {
  if (value === null) return VALID;
  const { isValid, reasons } = validateRange(value, constraints, { calendars });
  return { isValid, reasons };
};
