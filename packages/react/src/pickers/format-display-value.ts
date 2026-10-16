import { parseDate } from '@lunisolar-picker/calendar';
import { findCalendar, formatDateForField } from '@lunisolar-picker/core';
import type { DateRangeInput, PickerSettings } from '../index';

export const formatDisplayDate = (
  value: string | null | undefined,
  settings: PickerSettings,
  separator?: string,
): string => {
  if (!value) return '';
  const parsed = parseDate(value, { calendars: settings.calendars });
  if (!parsed.isOk) return '';
  const calendar = findCalendar(settings.calendars, parsed.value.calendar);
  return formatDateForField(parsed.value.epochDay, calendar, settings.locale, separator);
};

export const formatDisplayRange = (
  value: DateRangeInput | null | undefined,
  settings: PickerSettings,
  separator?: string,
): string => {
  if (!value) return '';
  const start = formatDisplayDate(value.start, settings, separator);
  const end = formatDisplayDate(value.end, settings, separator);
  return end ? `${start}${settings.locale.rangeSeparator}${end}` : start;
};
