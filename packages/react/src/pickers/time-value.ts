import { parseTime, type TimeString, type ValidationReason } from '@lunisolar-picker/calendar';

const EMPTY_TIME: ParsedTimeValue = { invalidReason: null, time: null };
const END_OF_DAY = '24:00';
// Constraint: 시각 문자열은 역법 구성과 무관하므로 역법 목록이 바뀌어도 같은 값을 다시 알리지 않음
export const TIME_PARSE_KEY = 'well-formed-time';

export type ParsedTimeValue = {
  readonly invalidReason: ValidationReason | null;
  readonly time: TimeString | null;
};

// Constraint: 형식만 보고 24:00을 받아 둠. 허용 여부는 폼에 낼 때(publicTimeOf) 따로 봄 (TimeField와 같음)
export const parseTimeValue = (value: string | null): ParsedTimeValue => {
  if (!value) return EMPTY_TIME;
  const parsed = parseTime(value, { isEndOfDayAllowed: true });
  return parsed.isOk ? { invalidReason: null, time: parsed.value.value } : { invalidReason: parsed.error, time: null };
};

export const publicTimeOf = (time: TimeString | null, isEndOfDayAllowed: boolean): TimeString | null =>
  time === END_OF_DAY && !isEndOfDayAllowed ? null : time;
