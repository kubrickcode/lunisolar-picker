import { type CalendarSystem, type EpochDay, LunisolarPickerError, parseMonthCode } from '@lunisolar-picker/calendar';
import { padDigits } from '../format-digits';
import type { DateSegmentKind } from '../types';
import type { LocaleData } from './locale-data';

const MONTH_DAY_DIGITS = 2;
const YEAR_DIGITS = 4;

export const formatDateForField = (
  epochDay: EpochDay,
  calendar: CalendarSystem,
  locale: LocaleData,
  separator: string = locale.field.separator,
): string => {
  const fields = calendar.fromEpochDay(epochDay);
  if (!fields.isOk) {
    throw new LunisolarPickerError(`cannot display epoch day ${epochDay} in ${calendar.id}: ${fields.error}`);
  }
  const { month, isLeapMonth } = parseMonthCode(fields.value.monthCode);
  const textByKind: Readonly<Record<DateSegmentKind, string>> = {
    day: padDigits(fields.value.day, MONTH_DAY_DIGITS),
    month: `${isLeapMonth ? locale.field.leapMonthPrefix : ''}${padDigits(month, MONTH_DAY_DIGITS)}`,
    year: padDigits(fields.value.year, YEAR_DIGITS),
  };
  return locale.field.order.map((kind) => textByKind[kind]).join(separator);
};
