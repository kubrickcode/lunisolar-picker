import {
  civilFromEpochDay,
  formatMonth,
  gregory,
  type MonthString,
  parseMonth,
  toMonthCode,
} from '@lunisolar-picker/calendar';
import { invalidBecause, type LocaleData, VALID, type Validity } from '@lunisolar-picker/core';
import { type FocusEvent, type RefObject, useRef, useState } from 'react';
import type { ButtonGridItem } from '../calendar/month-button-grid';
import { focusTabbableDay, MISSING_REQUIRED, useMountSelections } from '../calendar/selection-binding';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerSettings } from '../settings/use-picker-settings';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { useControllableState } from '../utilities/use-controllable-state';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { parseOptionalMonth } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';

const FIRST_MONTH = 1;
const MONTH_PARSE_KEY = 'month-string';
const MONTHS_PER_YEAR = 12;

type MonthBounds = {
  readonly max: MonthString | null;
  readonly min: MonthString | null;
};

export type MonthCalendarApi = {
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly items: readonly ButtonGridItem[];
  readonly locale: LocaleData;
  // Goal: 선택이 없을 때 열리면 포커스할 이번 달. 보이는 해가 올해가 아니면 없음
  readonly todayMonthKey: string | undefined;
  readonly year: number;
  canShowYear(year: number): boolean;
  getHiddenInputProps(): HiddenInputProps;
  getRootProps(): MonthCalendarRootDomProps;
  showYear(year: number): void;
};

export type MonthCalendarRootDomProps = DataAttributeProps & {
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly ref: RefObject<HTMLDivElement | null>;
};

type MonthValidityInput = {
  readonly bounds: MonthBounds;
  readonly isRequired: boolean;
  readonly month: MonthString | null;
};

export type UseMonthCalendarProps = SharedPickerProps & {
  readonly defaultValue?: string | null | undefined;
  readonly max?: string | undefined;
  readonly min?: string | undefined;
  readonly onValueChange?: ((value: MonthString | null, details: ValueChangeDetails) => void) | undefined;
  readonly value?: string | null | undefined;
};

// Goal: 단일 달력과 같은 값 규칙을 월 단위로 지킴. 콜백은 사용자 조작에만 호출 시점에 부르고, 부모가 거부하면 부모 값을 보이며, form reset은 비제어만 마운트 때 기본값으로 돌아감
// Constraint: MonthString은 양력 연·월이라 역법 구성(calendars)과 무관함. 월 이름도 늘 양력으로 적음
export const useMonthCalendar = (props: UseMonthCalendarProps): MonthCalendarApi => {
  const settings = usePickerSettings(props);
  const controlled = useParsedValue(props.value, parseOptionalMonth, String, props.onInvalidValue, MONTH_PARSE_KEY);
  const { defaultSelected, initialSelected } = useMountSelections({
    controlled,
    readDefault: () => parseOptionalMonth(props.defaultValue).value,
    toSelected: (month: MonthString | null) => month,
  });
  const [selected, setSelected] = useControllableState<MonthString | null>(
    controlled.isControlled ? controlled.value : undefined,
    defaultSelected,
    undefined,
  );
  const today = civilFromEpochDay(settings.todayEpochDay);
  const [year, setYear] = useState(() => yearOf(initialSelected) ?? today.year);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Constraint: 형식이 틀린 min·max는 제약으로 쓰지 않음
  const bounds: MonthBounds = { min: parseOptionalMonth(props.min).value, max: parseOptionalMonth(props.max).value };
  const isRequired = props.required === true;
  const isDisabled = props.disabled === true;
  const isReadOnly = props.readOnly === true;
  const validityOf = (month: MonthString | null): Validity => monthValidity({ bounds, isRequired, month });
  const isInvalid = isVisiblyInvalid({ invalid: props.invalid === true, reasons: validityOf(selected).reasons });

  const report = (month: MonthString | null): void => {
    setSelected(month);
    props.onValueChange?.(month, { validity: validityOf(month) });
  };

  const pick = (month: MonthString): void => {
    if (month !== selected) report(month);
  };

  // Goal: 비제어만 form reset에서 처음 기본값으로 돌아가며 알림. 제어 값은 부모가 정함 (계약 §3.3 #1)
  const resetToDefault = (): void => {
    if (!controlled.isControlled && defaultSelected !== selected) report(defaultSelected);
  };

  const canShowYear = (candidate: number): boolean => !isDisabled && formatMonth(candidate, FIRST_MONTH).isOk;

  const items = Array.from({ length: MONTHS_PER_YEAR }, (_, index): ButtonGridItem => {
    const month = index + FIRST_MONTH;
    const formatted = formatMonth(year, month);
    const candidate = formatted.isOk ? formatted.value : null;
    const name = settings.locale.formatMonthName({ year, monthCode: toMonthCode(month, false) }, gregory.id);
    return {
      key: String(month),
      label: name,
      accessibleName: name,
      isSelected: candidate !== null && candidate === selected,
      isDisabled: candidate === null || !monthValidity({ bounds, isRequired: false, month: candidate }).isValid,
      onPick: () => {
        if (candidate !== null) pick(candidate);
      },
    };
  });

  return {
    isDisabled,
    isReadOnly,
    items,
    locale: settings.locale,
    todayMonthKey: year === today.year ? String(today.month) : undefined,
    year,
    canShowYear,
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: selected ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: () => focusTabbableDay(rootRef),
      onFormReset: resetToDefault,
    }),
    // Constraint: 월·연 이동 버튼 사이를 오갈 때는 조용하고 월 달력 전체를 벗어날 때만 onBlur를 알림 (preflight 3.1)
    getRootProps: () => ({
      onBlur: createFocusLeaveListener(props.onBlur),
      ref: rootRef,
      ...partAttributes('month-calendar', { disabled: isDisabled, readonly: isReadOnly, invalid: isInvalid }),
    }),
    showYear: (candidate) => {
      if (canShowYear(candidate)) setYear(candidate);
    },
  };
};

const monthValidity = ({ bounds, isRequired, month }: MonthValidityInput): Validity => {
  if (month === null) return isRequired ? MISSING_REQUIRED : VALID;
  if (bounds.min !== null && month < bounds.min) return invalidBecause(['before-min']);
  if (bounds.max !== null && month > bounds.max) return invalidBecause(['after-max']);
  return VALID;
};

const yearOf = (month: MonthString | null): number | null => {
  if (month === null) return null;
  const parsed = parseMonth(month);
  return parsed.isOk ? parsed.value.year : null;
};
