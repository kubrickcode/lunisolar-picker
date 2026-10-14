import { err, ok, type Result } from '../result';
import type { ValidationReason } from '../validation-reason';
import { calendarIdOf, type DateString, epochDayOf } from './date-string';

export interface DateRangeValue {
  readonly start: DateString;
  readonly end: DateString | null;
}

// Constraint: 양 끝은 같은 역법이어야 하고 start가 end보다 늦으면 순서를 바꿈 (스펙 4.2 범위 불변식)
export const normalizeDateRange = (
  start: DateString,
  end: DateString | null,
): Result<DateRangeValue, ValidationReason> => {
  if (end === null) return ok({ start, end });
  if (calendarIdOf(start) !== calendarIdOf(end)) return err('invalid-date');
  return ok(epochDayOf(end) < epochDayOf(start) ? { start: end, end: start } : { start, end });
};

export const isSameRange = (first: DateRangeValue | null, second: DateRangeValue | null): boolean => {
  if (first === null || second === null) return first === second;
  return first.start === second.start && first.end === second.end;
};
