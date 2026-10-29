import { padNumber } from '../format-number';
import { err, ok, type Result } from '../result';
import type { ValidationReason } from '../validation-reason';

const END_OF_DAY_HOUR = 24;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const TIME_PART_DIGITS = 2;
const TIME_STRING_PATTERN = /^(\d{2}):(\d{2})$/;

declare const timeStringBrand: unique symbol;

export type TimeString = string & { readonly [timeStringBrand]: true };

export interface ParsedTime {
  readonly hour: number;
  readonly minute: number;
  readonly value: TimeString;
}

export interface TimeOptions {
  readonly isEndOfDayAllowed?: boolean;
}

type TimeCandidate = {
  readonly hour: number;
  readonly isEndOfDayAllowed: boolean;
  readonly minute: number;
};

export const parseTime = (input: string, options: TimeOptions = {}): Result<ParsedTime, ValidationReason> => {
  const match = TIME_STRING_PATTERN.exec(input);
  if (!match) return err('invalid-time');
  return formatParsedTime(Number(match[1]), Number(match[2]), options);
};

export const formatTime = (
  hour: number,
  minute: number,
  options: TimeOptions = {},
): Result<TimeString, ValidationReason> => {
  const parsed = formatParsedTime(hour, minute, options);
  return parsed.isOk ? ok(parsed.value.value) : parsed;
};

const formatParsedTime = (hour: number, minute: number, options: TimeOptions): Result<ParsedTime, ValidationReason> => {
  const isEndOfDayAllowed = options.isEndOfDayAllowed === true;
  if (!isValidTime({ hour, isEndOfDayAllowed, minute })) return err('invalid-time');
  const value = `${padNumber(hour, TIME_PART_DIGITS)}:${padNumber(minute, TIME_PART_DIGITS)}`;
  return ok({ hour, minute, value: value as TimeString }); // as: brand — value는 isValidTime으로 검증한 정수 부분들로 조립함
};

// Constraint: 24:00은 하루의 끝을 뜻하는 표기라 분이 0일 때만 허용하고 다음 날로 바꾸지 않음 (스펙 4.2)
const isValidTime = ({ hour, isEndOfDayAllowed, minute }: TimeCandidate): boolean => {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  if (hour === END_OF_DAY_HOUR) return isEndOfDayAllowed && minute === 0;
  return hour >= 0 && hour <= LAST_HOUR && minute >= 0 && minute <= LAST_MINUTE;
};
