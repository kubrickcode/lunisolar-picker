import { type CalendarSystem, type EpochDay, gregory, parseDate } from '@lunisolar-picker/calendar';
import { findCalendar } from '../context';
import { invalidBecause, type Validity } from '../types';
import { type DateConstraints, type RangeConstraints, resolveConstraints } from './resolve-constraints';
import { validateEpochDay, validateEpochRange } from './validate';

export interface ValidationOptions {
  readonly calendars?: readonly CalendarSystem[];
}

// Goal: 앱이 프리셋 버튼을 비활성화·강조할 때 picker 상태 없이 문자열만으로 같은 규칙을 쓰게 함 (스펙 2.2)
export const validateDate = (
  value: string,
  constraints: DateConstraints = {},
  options: ValidationOptions = {},
): Validity => {
  const knownCalendars = withGregorian(options.calendars);
  const parsed = parseDate(value, { calendars: knownCalendars });
  if (!parsed.isOk) return invalidBecause([parsed.error]);
  const resolved = resolveConstraints(constraints, findCalendar(knownCalendars, parsed.value.calendar), knownCalendars);
  return validateEpochDay(parsed.value.epochDay, resolved);
};

export const validateRange = (
  range: { readonly start: string; readonly end: string | null },
  constraints: RangeConstraints = {},
  options: ValidationOptions = {},
): Validity => {
  const knownCalendars = withGregorian(options.calendars);
  const start = parseDate(range.start, { calendars: knownCalendars });
  const end = range.end === null ? null : parseDate(range.end, { calendars: knownCalendars });
  if (!start.isOk) return invalidBecause([start.error]);
  if (end !== null && !end.isOk) return invalidBecause([end.error]);
  const resolved = resolveConstraints(constraints, findCalendar(knownCalendars, start.value.calendar), knownCalendars);
  const endEpochDay: EpochDay | null = end === null ? null : end.value.epochDay;
  const isReversed = endEpochDay !== null && endEpochDay < start.value.epochDay;
  return validateEpochRange(
    isReversed ? { start: endEpochDay, end: start.value.epochDay } : { start: start.value.epochDay, end: endEpochDay },
    resolved,
  );
};

const withGregorian = (calendars: readonly CalendarSystem[] | undefined): readonly CalendarSystem[] => [
  gregory,
  ...(calendars ?? []).filter((calendar) => calendar.id !== gregory.id),
];
