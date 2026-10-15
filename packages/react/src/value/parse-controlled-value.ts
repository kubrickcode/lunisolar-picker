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

// Goal: 범위 필드·범위 picker가 받는 범위 입력 모양. 공개 API라 M4 picker가 다시 정의하지 않고 가져다 씀
export interface DateRangeInput {
  readonly end: string | null;
  readonly start: string;
}

export type ParsedControlledValue<Value> = {
  readonly invalidReason: ValidationReason | null;
  readonly value: Value | null;
};

// Goal: 범위 입력을 onInvalidValue에 넘길 한 줄 문자열로 적음. 범위 필드·범위 달력이 같은 모양으로 알림
export const describeRangeInput = (input: DateRangeInput): string => `${input.start}/${input.end ?? ''}`;

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
