import {
  type CalendarSystem,
  type DateRangeValue,
  type DateString,
  normalizeDateRange,
  parseDate,
  parseTime,
  type TimeString,
  type ValidationReason,
} from '@lunisolar-picker/calendar';

const EMPTY: ParsedControlledValue<never> = { value: null, invalidReason: null };

export type DateRangeInput = {
  readonly end: string | null;
  readonly start: string;
};

export type ParsedControlledValue<Value> = {
  readonly invalidReason: ValidationReason | null;
  readonly value: Value | null;
};

// Goal: store에 넣는 값은 parseDate를 거친 정규 문자열만. 입력 역법에서 표현 가능한 값만 store에 들어감 (계약 §2.7 ④)
export const parseOptionalDate = (
  input: string | null | undefined,
  calendars: readonly CalendarSystem[],
): ParsedControlledValue<DateString> => {
  if (input === undefined || input === null || input === '') return EMPTY;
  const parsed = parseDate(input, { calendars });
  return parsed.isOk
    ? { value: parsed.value.value, invalidReason: null }
    : { value: null, invalidReason: parsed.error };
};

export const parseOptionalRange = (
  input: DateRangeInput | null | undefined,
  calendars: readonly CalendarSystem[],
): ParsedControlledValue<DateRangeValue> => {
  if (input === undefined || input === null) return EMPTY;
  const start = parseOptionalDate(input.start, calendars);
  if (start.value === null) return { value: null, invalidReason: start.invalidReason ?? 'incomplete' };
  const end = parseOptionalDate(input.end, calendars);
  if (end.invalidReason !== null) return { value: null, invalidReason: end.invalidReason };
  const normalized = normalizeDateRange(start.value, end.value);
  return normalized.isOk
    ? { value: normalized.value, invalidReason: null }
    : { value: null, invalidReason: normalized.error };
};

export const parseOptionalTime = (
  input: string | null | undefined,
  options: { readonly isEndOfDayAllowed: boolean },
): ParsedControlledValue<TimeString> => {
  if (input === undefined || input === null || input === '') return EMPTY;
  const parsed = parseTime(input, options);
  return parsed.isOk
    ? { value: parsed.value.value, invalidReason: null }
    : { value: null, invalidReason: parsed.error };
};
