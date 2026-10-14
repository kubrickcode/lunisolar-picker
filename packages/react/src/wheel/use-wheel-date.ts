import {
  type CalendarId,
  calendarIdOf,
  type DateFields,
  type DateString,
  type EpochDay,
  epochDayOf,
  gregory,
  type MonthCode,
} from '@lunisolar-picker/calendar';
import {
  boundsFor,
  buildWheelDateColumns,
  clampEpochDay,
  constrainDateFields,
  type DateConstraints,
  epochDayOfFields,
  fieldsOf,
  findCalendar,
  invalidBecause,
  type ResolvedConstraints,
  VALID,
  type Validity,
  validateEpochDay,
  type WheelDateColumns,
} from '@lunisolar-picker/core';
import { type FocusEvent, type RefCallback, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PART_ATTRIBUTE } from '../contract/data-attributes';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerContext } from '../settings/use-picker-context';
import { usePickerSettings } from '../settings/use-picker-settings';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

const FIRST_COLUMN_SELECTOR = `[${PART_ATTRIBUTE}="wheel-column"]`;
const FIRST_DAY = 1;

type InitialPositionInput = {
  readonly emptyCalendarId: CalendarId;
  readonly value: DateString | null;
};

type ValidityInput = {
  readonly constraints: ResolvedConstraints;
  readonly position: WheelDatePosition;
  readonly value: DateString | null;
};

// Goal: 값이 없어도 휠은 늘 어떤 날을 보여줌. 사용자가 고르기 전까지 공개 값은 null (preflight 2.12)
// Constraint: 부모가 준 값은 제약 밖이어도 그대로 둠(값 우선, 콜백 없음). 휠에 보이는 날만 제약 범위로 자름
type WheelDatePosition =
  | { readonly calendarId: CalendarId; readonly epochDay: EpochDay; readonly hasSelection: true }
  | {
      readonly calendarId: CalendarId;
      // Constraint: null이면 휠이 아직 어떤 날에도 선 적이 없어 렌더마다 지금의 오늘에 섬. 서버 렌더의 UTC 오늘을 상태에 굳히면 hydration 뒤 브라우저의 오늘로 바뀌지 않음
      readonly epochDay: EpochDay | null;
      readonly hasSelection: false;
    };

export interface UseWheelDateProps extends SharedPickerProps, Omit<DateConstraints, 'isDateDisabled'> {
  readonly value?: string | null | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly onValueChange?: ((value: DateString | null, details: ValueChangeDetails) => void) | undefined;
  readonly entryCalendar?: CalendarId | undefined;
  readonly defaultEntryCalendar?: CalendarId | undefined;
  readonly onEntryCalendarChange?: ((calendarId: CalendarId) => void) | undefined;
}

export interface WheelDateApi {
  readonly fields: DateFields;
  readonly columns: WheelDateColumns;
  readonly value: DateString | null;
  readonly validity: Validity;
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  readonly entryCalendarId: CalendarId;
  readonly labels: { readonly year: string; readonly month: string; readonly day: string };
  selectYear(year: number): void;
  selectMonth(monthCode: MonthCode): void;
  selectDay(day: number): void;
  setEntryCalendar(calendarId: CalendarId): void;
  focus(): void;
  getRootProps(): WheelDateRootProps;
  getHiddenInputProps(): HiddenInputProps;
}

// Goal: <Wheel.Root>에 펼치는 props. disabled·readOnly는 Root가 모든 열에 퍼뜨리고, invalid는 Root의 data-invalid가 됨
export interface WheelDateRootProps {
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly readOnly: boolean;
  readonly ref: RefCallback<HTMLElement>;
}

// Constraint: 선택한 날은 React 상태로 둠. core 함수(boundsFor·constrainDateFields·buildWheelDateColumns) 위의 얇은 연결이라 별도 store 없이 씀 (preflight 4.9)
export const useWheelDate = (props: UseWheelDateProps): WheelDateApi => {
  const settings = usePickerSettings(props);
  const controlled = useParsedValue(
    props.value,
    (input) => parseOptionalDate(input, settings.calendars),
    String,
    props.onInvalidValue,
    settings.calendarKey,
  );
  const isDisabled = props.disabled === true;
  const isReadOnly = props.readOnly === true;
  // Constraint: 값이 있으면 값의 역법이 휠의 역법. entryCalendar·defaultEntryCalendar는 값이 없을 때만 씀 (계약 §3.3)
  const [initialPosition] = useState<WheelDatePosition>(() =>
    initialPositionOf({
      value: controlled.value ?? parseOptionalDate(props.defaultValue, settings.calendars).value,
      emptyCalendarId: props.entryCalendar ?? props.defaultEntryCalendar ?? gregory.id,
    }),
  );
  const [position, setPosition] = useState<WheelDatePosition>(initialPosition);
  const rootRef = useRef<HTMLElement | null>(null);
  const context = usePickerContext(settings, { constraints: props, commitMode: 'immediate', numberOfMonths: 1 });
  // Constraint: 앱이 calendars에서 지금 역법을 빼도 렌더 중에 던지지 않고 양력으로 보여 줌. 위치는 epochDay라 같은 날을 양력으로 다시 적음
  const calendar = settings.calendars.find((candidate) => candidate.id === position.calendarId) ?? gregory;
  const bounds = useMemo(() => boundsFor(calendar, context.constraints), [calendar, context.constraints]);
  // Constraint: 제약이 입력 역법 범위와 겹치지 않으면 고를 날이 없음. 자른 날이 역법 범위 밖이라 fieldsOf가 던지므로 역법 첫날을 보여줌 (preflight 3.8)
  const hasSelectableDay = bounds.min <= bounds.max;
  const restingEpochDay = position.epochDay ?? settings.todayEpochDay;
  const shownEpochDay = hasSelectableDay ? clampEpochDay(restingEpochDay, bounds) : calendar.supportedRange.min;
  const fields = useMemo(() => fieldsOf(calendar, shownEpochDay), [calendar, shownEpochDay]);
  const { year, monthCode } = fields;
  // Goal: 일만 바뀌면 옵션 배열을 다시 만들지 않음. 휠은 새 배열을 새 상태로 다루므로 9999개 연도 열을 매번 바꾸지 않게 함 (계약 §2.8 ⑥)
  const columns = useMemo(
    () => buildWheelDateColumns(calendar, { year, monthCode, day: FIRST_DAY }, context.constraints, settings.locale),
    [calendar, year, monthCode, context.constraints, settings.locale],
  );
  const value = useMemo(
    () => (position.hasSelection ? formatOrNull(position.epochDay, calendar) : null),
    [position, calendar],
  );
  const validity = useMemo(
    () => validityOf({ constraints: context.constraints, position, value }),
    [context.constraints, position, value],
  );
  const isInvalid = isVisiblyInvalid({ invalid: props.invalid === true, reasons: validity.reasons });

  // Constraint: 마운트 때 값의 역법과 entryCalendar가 달라도 값의 역법을 유지함. prop이 실제로 바뀔 때만 명시적 요청으로 보고 휠의 역법을 바꿈 (계약 §3.3)
  const lastRequestedCalendarIdRef = useRef(props.entryCalendar);
  useEffect(() => {
    const requested = props.entryCalendar;
    if (requested === undefined || requested === lastRequestedCalendarIdRef.current) return;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    lastRequestedCalendarIdRef.current = requested;
    setPosition((previous) => ({ ...previous, calendarId: requested }));
  }, [props.entryCalendar]);

  useValueBridge<DateString>({
    committedValue: value,
    controlled,
    isEqual: Object.is,
    // Constraint: 부모가 다른 역법으로 적힌 값을 주면 휠의 역법도 그 역법이 됨(값 우선). 부모가 한 일이라 onEntryCalendarChange는 부르지 않음
    // Constraint: 부모가 null을 주면 휠 위치는 두고 공개 값만 비움. 휠에 보이던 날을 사용자가 고른 값처럼 알리지 않음 (preflight 2.12)
    syncStore: (next) =>
      setPosition((previous) => {
        if (next !== null) return selectedPositionOf(next);
        return previous.hasSelection ? { ...previous, hasSelection: false } : previous;
      }),
    onValueChange: (next) => props.onValueChange?.(next, { validity }),
  });

  // Goal: 연·월을 바꿔 사라진 윤달·30일은 가장 가까운 날로 맞추고, 제약 범위 밖이면 경계로 붙임 (스펙 5.4)
  const selectFields = (nextFields: DateFields): void => {
    if (!hasSelectableDay) return;
    const epochDay = epochDayOfFields(calendar, constrainDateFields(calendar, nextFields));
    setPosition({ calendarId: calendar.id, epochDay: clampEpochDay(epochDay, bounds), hasSelection: true });
  };

  // Constraint: 입력 부품은 부모가 거부해도 되돌리지 않음(useValueBridge와 같은 정책). 사용자가 바꾼 역법은 바로 반영하고 알림
  const setEntryCalendar = (calendarId: CalendarId): void => {
    if (calendarId === calendar.id) return;
    // Constraint: 모르는 역법 id는 다음 렌더가 아니라 호출한 곳에서 LunisolarPickerError로 드러나게 함
    findCalendar(settings.calendars, calendarId);
    setPosition((previous) => ({ ...previous, calendarId }));
    props.onEntryCalendarChange?.(calendarId);
  };

  // Goal: 비제어일 때만 form reset으로 처음 기본값(없으면 오늘을 따르는 빈 휠)으로 돌아감. 제어 값은 부모가 정함
  const resetToDefault = (): void => {
    if (!controlled.isControlled) setPosition(initialPosition);
  };

  const focus = useCallback(() => {
    rootRef.current?.querySelector<HTMLElement>(FIRST_COLUMN_SELECTOR)?.focus({ preventScroll: true });
  }, []);

  const attachRoot = useCallback<RefCallback<HTMLElement>>((node) => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    rootRef.current = node;
  }, []);

  return {
    fields,
    columns,
    value,
    validity,
    isInvalid,
    isDisabled,
    isReadOnly,
    entryCalendarId: calendar.id,
    labels: { year: settings.locale.labels.year, month: settings.locale.labels.month, day: settings.locale.labels.day },
    selectYear: (nextYear) => selectFields({ ...fields, year: nextYear }),
    selectMonth: (nextMonthCode) => selectFields({ ...fields, monthCode: nextMonthCode }),
    selectDay: (day) => selectFields({ ...fields, day }),
    setEntryCalendar,
    focus,
    // Constraint: 열 사이 이동은 휠 안이므로 휠 전체를 벗어날 때만 onBlur를 알림
    getRootProps: () => ({
      ref: attachRoot,
      disabled: isDisabled,
      readOnly: isReadOnly,
      invalid: isInvalid,
      onBlur: createFocusLeaveListener(props.onBlur),
    }),
    getHiddenInputProps: () => ({
      name: props.name,
      form: props.form,
      value: value ?? '',
      required: props.required,
      disabled: props.disabled,
      onFocusRequest: focus,
      onFormReset: resetToDefault,
    }),
  };
};

const initialPositionOf = ({ emptyCalendarId, value }: InitialPositionInput): WheelDatePosition =>
  value === null ? { calendarId: emptyCalendarId, epochDay: null, hasSelection: false } : selectedPositionOf(value);

const selectedPositionOf = (value: DateString): WheelDatePosition => ({
  calendarId: calendarIdOf(value),
  epochDay: epochDayOf(value),
  hasSelection: true,
});

// Constraint: 고른 날을 다른 역법으로 바꿨는데 그 역법이 표현하지 못하면 공개 값은 null이고 이유를 함께 알림
const validityOf = ({ constraints, position, value }: ValidityInput): Validity => {
  if (!position.hasSelection) return VALID;
  if (value === null) return invalidBecause(['outside-calendar-range']);
  return validateEpochDay(position.epochDay, constraints);
};
