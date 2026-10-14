import {
  brandEpochDay,
  type CalendarSystem,
  type DateFields,
  type EpochDay,
  LunisolarPickerError,
  type MonthCode,
  parseMonthCode,
  toMonthCode,
} from '@lunisolar-picker/calendar';
import type { ResolvedConstraints } from '../constraints/resolve-constraints';
import type { VisibleMonth } from '../types';

export interface CalendarBounds {
  readonly min: EpochDay;
  readonly max: EpochDay;
}

export const boundsFor = (calendar: CalendarSystem, constraints: ResolvedConstraints): CalendarBounds => ({
  min: brandEpochDay(Math.max(constraints.minEpochDay, calendar.supportedRange.min)),
  max: brandEpochDay(Math.min(constraints.maxEpochDay, calendar.supportedRange.max)),
});

export const clampEpochDay = (epochDay: EpochDay, bounds: CalendarBounds): EpochDay =>
  brandEpochDay(Math.min(Math.max(epochDay, bounds.min), bounds.max));

export const constrainDateFields = (calendar: CalendarSystem, fields: DateFields): DateFields => {
  const { firstYear, lastYear } = supportedYearRange(calendar);
  const year = Math.min(Math.max(fields.year, firstYear), lastYear);
  const monthCode = nearestMonthCode(calendar.monthsInYear(year), fields.monthCode);
  const day = Math.min(Math.max(fields.day, 1), calendar.daysInMonth(year, monthCode));
  const constrained: DateFields = { year, monthCode, day };
  if (calendar.toEpochDay(constrained).isOk) return constrained;
  return fieldsOf(calendar, calendar.supportedRange.max);
};

export const daysInVisibleMonth = (calendar: CalendarSystem, month: VisibleMonth): number =>
  calendar.daysInMonth(month.year, month.monthCode);

export const epochDayOfFields = (calendar: CalendarSystem, fields: DateFields): EpochDay => {
  const epochDay = calendar.toEpochDay(fields);
  if (!epochDay.isOk) {
    throw new LunisolarPickerError(
      `${calendar.id} cannot place ${fields.year} ${fields.monthCode} ${fields.day}: ${epochDay.error}`,
    );
  }
  return epochDay.value;
};

export const fieldsOf = (calendar: CalendarSystem, epochDay: EpochDay): DateFields => {
  const fields = calendar.fromEpochDay(epochDay);
  if (!fields.isOk) throw new LunisolarPickerError(`${calendar.id} cannot read epoch day ${epochDay}: ${fields.error}`);
  return fields.value;
};

export const firstEpochDayOfMonth = (calendar: CalendarSystem, month: VisibleMonth): EpochDay =>
  epochDayOfFields(calendar, { ...month, day: 1 });

export const supportedYearRange = (
  calendar: CalendarSystem,
): { readonly firstYear: number; readonly lastYear: number } => ({
  firstYear: fieldsOf(calendar, calendar.supportedRange.min).year,
  lastYear: fieldsOf(calendar, calendar.supportedRange.max).year,
});

const nearestMonthCode = (monthCodes: readonly MonthCode[], wanted: MonthCode): MonthCode => {
  if (monthCodes.includes(wanted)) return wanted;
  const { month } = parseMonthCode(wanted);
  const regularCode = toMonthCode(month, false);
  if (monthCodes.includes(regularCode)) return regularCode;
  const earlierCodes = monthCodes.filter((code) => parseMonthCode(code).month <= month);
  const fallback = earlierCodes.at(-1) ?? monthCodes[0];
  if (!fallback) throw new LunisolarPickerError(`calendar returned no months while constraining ${wanted}`);
  return fallback;
};
