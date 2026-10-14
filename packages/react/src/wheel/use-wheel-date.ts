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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { usePickerContext } from '../settings/use-picker-context';
import { usePickerSettings } from '../settings/use-picker-settings';
import { formatOrNull } from '../value/format-or-null';
import { parseOptionalDate } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';

const FIRST_DAY = 1;

type ValidityInput = {
  readonly constraints: ResolvedConstraints;
  readonly position: WheelDatePosition;
  readonly value: DateString | null;
};

type WheelDatePosition = {
  readonly calendarId: CalendarId;
  // Constraint: 부모가 준 값은 제약 밖이어도 그대로 둠(값 우선, 콜백 없음). 휠에 보이는 날만 제약 범위로 자름
  readonly epochDay: EpochDay;
  // Goal: 값이 없어도 휠은 늘 어떤 날을 보여줌. 사용자가 고르기 전까지 공개 값은 null (preflight 2.12)
  readonly hasSelection: boolean;
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
  readonly entryCalendarId: CalendarId;
  readonly labels: { readonly year: string; readonly month: string; readonly day: string };
  selectYear(year: number): void;
  selectMonth(monthCode: MonthCode): void;
  selectDay(day: number): void;
  setEntryCalendar(calendarId: CalendarId): void;
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
  // Constraint: 값이 있으면 값의 역법이 휠의 역법. entryCalendar·defaultEntryCalendar는 값이 없을 때만 씀 (계약 §3.3)
  const [position, setPosition] = useState<WheelDatePosition>(() => {
    const initialValue = controlled.value ?? parseOptionalDate(props.defaultValue, settings.calendars).value;
    if (initialValue === null) {
      return {
        calendarId: props.entryCalendar ?? props.defaultEntryCalendar ?? gregory.id,
        epochDay: settings.todayEpochDay,
        hasSelection: false,
      };
    }
    return { calendarId: calendarIdOf(initialValue), epochDay: epochDayOf(initialValue), hasSelection: true };
  });
  const context = usePickerContext(settings, { constraints: props, commitMode: 'immediate', numberOfMonths: 1 });
  const calendar = findCalendar(settings.calendars, position.calendarId);
  const bounds = useMemo(() => boundsFor(calendar, context.constraints), [calendar, context.constraints]);
  // Constraint: 제약이 입력 역법 범위와 겹치지 않으면 고를 날이 없음. 자른 날이 역법 범위 밖이라 fieldsOf가 던지므로 역법 첫날을 보여줌 (preflight 3.8)
  const hasSelectableDay = bounds.min <= bounds.max;
  const shownEpochDay = hasSelectableDay ? clampEpochDay(position.epochDay, bounds) : calendar.supportedRange.min;
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
        if (next !== null) return { calendarId: calendarIdOf(next), epochDay: epochDayOf(next), hasSelection: true };
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
    if (calendarId === position.calendarId) return;
    // Constraint: 모르는 역법 id는 다음 렌더가 아니라 호출한 곳에서 LunisolarPickerError로 드러나게 함
    findCalendar(settings.calendars, calendarId);
    setPosition((previous) => ({ ...previous, calendarId }));
    props.onEntryCalendarChange?.(calendarId);
  };

  return {
    fields,
    columns,
    value,
    entryCalendarId: position.calendarId,
    labels: { year: settings.locale.labels.year, month: settings.locale.labels.month, day: settings.locale.labels.day },
    selectYear: (nextYear) => selectFields({ ...fields, year: nextYear }),
    selectMonth: (nextMonthCode) => selectFields({ ...fields, monthCode: nextMonthCode }),
    selectDay: (day) => selectFields({ ...fields, day }),
    setEntryCalendar,
  };
};

// Constraint: 고른 날을 다른 역법으로 바꿨는데 그 역법이 표현하지 못하면 공개 값은 null이고 이유를 함께 알림
const validityOf = ({ constraints, position, value }: ValidityInput): Validity => {
  if (!position.hasSelection) return VALID;
  if (value === null) return invalidBecause(['outside-calendar-range']);
  return validateEpochDay(position.epochDay, constraints);
};
