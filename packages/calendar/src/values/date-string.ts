import { type CalendarId, type CalendarSystem, type DateFields, isWithinSupportedRange } from '../calendar-system';
import { brandEpochDay, civilFromEpochDay, type EpochDay, epochDayFromCivil } from '../epoch-day';
import { LunisolarPickerError } from '../errors';
import { padNumber } from '../format-number';
import { gregory } from '../gregorian';
import { toMonthCode } from '../month-code';
import { err, ok, type Result } from '../result';
import type { ValidationReason } from '../validation-reason';

const ANNOTATION_PREFIX_LENGTH = '[u-ca='.length;
const DATE_STRING_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:\[u-ca=([a-z]+)\])?$/;
const DAY_START = 8;
const ISO_DATE_LENGTH = 10;
const MONTH_DIGITS = 2;
const MONTH_END = 7;
const MONTH_START = 5;
const YEAR_DIGITS = 4;
const YEAR_END = 4;

declare const dateStringBrand: unique symbol;

// Goal: parseDate·formatDate를 거친 정규 문자열만 이 타입이 됨. 같은 날짜·같은 역법이면 항상 === 로 같음 (스펙 4.2)
export type DateString = string & { readonly [dateStringBrand]: true };

export interface ParseDateOptions {
  readonly calendars?: readonly CalendarSystem[];
}

export interface ParsedDate extends DateFields {
  readonly calendar: CalendarId;
  readonly epochDay: EpochDay;
  readonly value: DateString;
}

type ResolveAnnotatedCalendarInput = {
  readonly annotatedCalendarId: string | undefined;
  readonly calendars: readonly CalendarSystem[];
};

export const parseDate = (input: string, options: ParseDateOptions = {}): Result<ParsedDate, ValidationReason> => {
  const match = DATE_STRING_PATTERN.exec(input);
  if (!match) return err('invalid-date');
  const [, yearText = '', monthText = '', dayText = '', annotatedCalendarId] = match;
  const epochDay = isoPartsToEpochDay(Number(yearText), Number(monthText), Number(dayText));
  if (!epochDay.isOk) return epochDay;
  const calendar = resolveAnnotatedCalendar({ annotatedCalendarId, calendars: options.calendars ?? [] });
  if (!calendar) return err('invalid-date');
  const fields = calendar.fromEpochDay(epochDay.value);
  if (!fields.isOk) return fields;
  return ok({ ...fields.value, calendar: calendar.id, epochDay: epochDay.value, value: brandDateString(input) });
};

export const addDays = (
  value: DateString,
  amount: number,
  options: ParseDateOptions = {},
): Result<DateString, ValidationReason> => {
  if (!Number.isInteger(amount)) throw new LunisolarPickerError(`amount must be an integer, received ${amount}`);
  const calendar = resolveAnnotatedCalendar({
    annotatedCalendarId: annotatedCalendarIdOf(value),
    calendars: options.calendars ?? [],
  });
  if (!calendar) return err('invalid-date');
  return formatDate(brandEpochDay(epochDayOf(value) + amount), calendar);
};

export const calendarIdOf = (value: DateString): CalendarId => {
  if (value.length === ISO_DATE_LENGTH) return gregory.id;
  const calendarId = value.slice(ISO_DATE_LENGTH + ANNOTATION_PREFIX_LENGTH, -1);
  return calendarId as CalendarId; // as: brand — formatDate와 parseDate는 등록된 캘린더 id만 표기로 내보냄
};

export const epochDayOf = (value: DateString): EpochDay =>
  epochDayFromCivil(
    Number(value.slice(0, YEAR_END)),
    Number(value.slice(MONTH_START, MONTH_END)),
    Number(value.slice(DAY_START, ISO_DATE_LENGTH)),
  );

export const formatDate = (
  epochDay: EpochDay,
  calendar: CalendarSystem = gregory,
): Result<DateString, ValidationReason> => {
  if (!isWithinSupportedRange(gregory, epochDay) || !isWithinSupportedRange(calendar, epochDay)) {
    return err('outside-calendar-range');
  }
  const { year, month, day } = civilFromEpochDay(epochDay);
  const isoDate = `${padNumber(year, YEAR_DIGITS)}-${padNumber(month, MONTH_DIGITS)}-${padNumber(day, MONTH_DIGITS)}`;
  return ok(brandDateString(calendar.id === gregory.id ? isoDate : `${isoDate}[u-ca=${calendar.id}]`));
};

export const isSameDay = (first: DateString, second: DateString): boolean =>
  first.slice(0, ISO_DATE_LENGTH) === second.slice(0, ISO_DATE_LENGTH);

const annotatedCalendarIdOf = (value: DateString): string | undefined =>
  value.length === ISO_DATE_LENGTH ? undefined : calendarIdOf(value);

// as: brand — 호출부는 DATE_STRING_PATTERN 검증을 마쳤거나 formatDate가 만든 문자열만 넘김
const brandDateString = (value: string): DateString => value as DateString;

const isoPartsToEpochDay = (year: number, month: number, day: number): Result<EpochDay, ValidationReason> => {
  if (year === 0 || month < 1 || month > 12) return err('invalid-date');
  const epochDay = gregory.toEpochDay({ year, monthCode: toMonthCode(month, false), day });
  return epochDay.isOk ? epochDay : err('invalid-date');
};

// Constraint: 양력은 표기 없이만 쓰는 것이 정규 형식이라 [u-ca=gregory]는 거부함
const resolveAnnotatedCalendar = ({
  annotatedCalendarId,
  calendars,
}: ResolveAnnotatedCalendarInput): CalendarSystem | undefined => {
  if (annotatedCalendarId === undefined) return gregory;
  if (annotatedCalendarId === gregory.id) return undefined;
  return calendars.find((calendar) => calendar.id === annotatedCalendarId);
};
