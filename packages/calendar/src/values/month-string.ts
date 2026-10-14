import { padNumber } from '../format-number';
import { err, ok, type Result } from '../result';
import type { ValidationReason } from '../validation-reason';

const FIRST_YEAR = 1;
const LAST_YEAR = 9999;
const MONTH_DIGITS = 2;
const MONTH_STRING_PATTERN = /^(\d{4})-(\d{2})$/;
const YEAR_DIGITS = 4;

declare const monthStringBrand: unique symbol;

export type MonthString = string & { readonly [monthStringBrand]: true };

export interface ParsedMonth {
  readonly year: number;
  readonly month: number;
  readonly value: MonthString;
}

export const parseMonth = (input: string): Result<ParsedMonth, ValidationReason> => {
  const match = MONTH_STRING_PATTERN.exec(input);
  if (!match) return err('invalid-date');
  return toParsedMonth(Number(match[1]), Number(match[2]));
};

export const formatMonth = (year: number, month: number): Result<MonthString, ValidationReason> => {
  const parsed = toParsedMonth(year, month);
  return parsed.isOk ? ok(parsed.value.value) : parsed;
};

const toParsedMonth = (year: number, month: number): Result<ParsedMonth, ValidationReason> => {
  const isValidYear = Number.isInteger(year) && year >= FIRST_YEAR && year <= LAST_YEAR;
  const isValidMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  if (!isValidYear || !isValidMonth) return err('invalid-date');
  const value = `${padNumber(year, YEAR_DIGITS)}-${padNumber(month, MONTH_DIGITS)}`;
  return ok({ year, month, value: value as MonthString }); // as: brand — value는 위에서 검증한 정수 부분들로 조립함
};
