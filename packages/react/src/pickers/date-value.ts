import {
  type CalendarSystem,
  type DateString,
  formatDate,
  gregory,
  parseDate,
  type ValidationReason,
} from '@lunisolar-picker/calendar';
import { type DateConstraints, VALID, type Validity, validateDate } from '@lunisolar-picker/core';
import { useState } from 'react';
import type { PickerSettings } from '../index';

const EMPTY_VALUE: ParsedDateValue = { invalidReason: null, value: null };

type CalendarSetup = Pick<PickerSettings, 'calendarKey' | 'calendars'>;

type DateMoveInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly previousCalendars: readonly CalendarSystem[];
  readonly value: string | null;
};

type DateValidityInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly constraints: DateConstraints;
  readonly value: DateString | null;
};

export type ParsedDateValue = {
  readonly invalidReason: ValidationReason | null;
  readonly value: DateString | null;
};

type ValueOnProvidedCalendarsInput<Value> = {
  readonly isControlled: boolean;
  // Goal: 역법 구성이 바뀐 뒤 값을 새 구성에서 적을 수 있게 옮김. 옮길 것이 없으면 같은 값을 돌려줌
  readonly moveValue: (value: Value, previousCalendars: readonly CalendarSystem[]) => Value;
  readonly settings: CalendarSetup;
  readonly setValue: (value: Value) => void;
  readonly value: Value;
};

// Constraint: 완전히 빈 값은 required여도 VALID로 알림. required는 aria-required와 네이티브 required 검증만 맡음 (M3 입력 부품과 같음)
export const dateValidityOf = ({ calendars, constraints, value }: DateValidityInput): Validity => {
  if (value === null) return VALID;
  const { isValid, reasons } = validateDate(value, constraints, { calendars });
  return { isValid, reasons };
};

// Goal: 앱이 뺀 역법으로 적힌 날은 같은 날을 양력으로 적음. 이전 구성으로도 읽지 못하는 값이나 남은 역법의 값은 그대로 둠
export const moveDateOffRemovedCalendar = ({ calendars, previousCalendars, value }: DateMoveInput): string | null => {
  if (!value) return value;
  const previous = parseDate(value, { calendars: previousCalendars });
  if (!previous.isOk || calendars.some((calendar) => calendar.id === previous.value.calendar)) return value;
  const moved = formatDate(previous.value.epochDay, gregory);
  return moved.isOk ? moved.value : value;
};

export const parseDateValue = (value: string | null, calendars: readonly CalendarSystem[]): ParsedDateValue => {
  if (!value) return EMPTY_VALUE;
  const parsed = parseDate(value, { calendars });
  return parsed.isOk
    ? { invalidReason: null, value: parsed.value.value }
    : { invalidReason: parsed.error, value: null };
};

// Goal: 비제어 picker의 값은 그 역법을 앱이 calendars에서 빼도 같은 날로 남음. 제어 값은 부모가 정하므로 입력 부품처럼 해석 실패로 알림 (계약 §3.3 #6)
// Constraint: 렌더 중 상태 갱신이라 React가 자식(입력 칸·달력·휠)을 그리기 전에 다시 렌더함. 자식은 옮기기 전 값을 커밋하지 않아 비우거나 onInvalidValue를 부르지 않음 (useSlideDirection과 같은 방식)
// Constraint: 앱이 고른 값이 아니므로 onValueChange는 부르지 않음. 이전 구성은 렌더 중 바뀌어도 버려진 렌더와 어긋나지 않게 ref가 아닌 상태로 기억함
export const useValueOnProvidedCalendars = <Value>({
  isControlled,
  moveValue,
  settings,
  setValue,
  value,
}: ValueOnProvidedCalendarsInput<Value>): void => {
  const [previousSetup, setPreviousSetup] = useState<CalendarSetup>(() => ({
    calendarKey: settings.calendarKey,
    calendars: settings.calendars,
  }));
  if (previousSetup.calendarKey === settings.calendarKey) return;
  setPreviousSetup({ calendarKey: settings.calendarKey, calendars: settings.calendars });
  if (isControlled) return;
  const moved = moveValue(value, previousSetup.calendars);
  if (moved !== value) setValue(moved);
};
