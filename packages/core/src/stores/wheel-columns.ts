import { brandEpochDay, type CalendarSystem, type DateFields, type MonthCode } from '@lunisolar-picker/calendar';
import type { ResolvedConstraints } from '../constraints/resolve-constraints';
import { padDigits } from '../format-digits';
import {
  boundsFor,
  type CalendarBounds,
  daysInVisibleMonth,
  fieldsOf,
  firstEpochDayOfMonth,
} from '../grid/calendar-math';
import type { LocaleData } from '../locales/locale-data';
import type { VisibleMonth } from '../types';
import type { ColumnOption } from './column';
import { END_OF_DAY_HOUR, LAST_HOUR, MINUTES_PER_HOUR, TIME_PART_DIGITS, type TimeFieldContext } from './time-field';

export interface WheelDateColumns {
  readonly days: readonly ColumnOption<number>[];
  readonly months: readonly ColumnOption<MonthCode>[];
  readonly years: readonly ColumnOption<number>[];
}

export interface WheelTimeColumns {
  readonly hours: readonly ColumnOption<number>[];
  readonly minutes: readonly ColumnOption<number>[];
}

type DayColumnOptions = {
  readonly bounds: CalendarBounds;
  readonly calendar: CalendarSystem;
  readonly constraints: ResolvedConstraints;
  readonly month: VisibleMonth;
};

type MonthColumnOptions = {
  readonly bounds: CalendarBounds;
  readonly calendar: CalendarSystem;
  readonly locale: LocaleData;
  readonly year: number;
};

// Constraint: fields는 constrainDateFields를 거친 값이어야 함. 없는 윤달·30일이면 monthsInYear/daysInMonth가 던짐
// Constraint: 제약이 달력 범위 밖이라 bounds.min > bounds.max면 던지지 않고 연 열은 비우고 월·일은 전부 비활성으로 둠
export const buildWheelDateColumns = (
  calendar: CalendarSystem,
  fields: DateFields,
  constraints: ResolvedConstraints,
  locale: LocaleData,
): WheelDateColumns => {
  const bounds = boundsFor(calendar, constraints);
  const month = { monthCode: fields.monthCode, year: fields.year };
  return {
    days: buildDayColumn({ bounds, calendar, constraints, month }),
    months: buildMonthColumn({ bounds, calendar, locale, year: fields.year }),
    years: buildYearColumn(calendar, bounds),
  };
};

export const buildTimeColumns = (context: TimeFieldContext): WheelTimeColumns => {
  const lastHour = context.isEndOfDayAllowed ? END_OF_DAY_HOUR : LAST_HOUR;
  const minuteCount = Math.ceil(MINUTES_PER_HOUR / context.minuteStep);
  return {
    hours: Array.from({ length: lastHour + 1 }, (_, hour) => buildTimeOption(hour)),
    minutes: Array.from({ length: minuteCount }, (_, index) => buildTimeOption(index * context.minuteStep)),
  };
};

const isInvertedBounds = (bounds: CalendarBounds): boolean => bounds.min > bounds.max;

const buildYearColumn = (calendar: CalendarSystem, bounds: CalendarBounds): readonly ColumnOption<number>[] => {
  if (isInvertedBounds(bounds)) return [];
  const firstYear = fieldsOf(calendar, bounds.min).year;
  const lastYear = fieldsOf(calendar, bounds.max).year;
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const year = firstYear + index;
    return { isDisabled: false, label: String(year), value: year };
  });
};

const buildMonthColumn = ({ bounds, calendar, locale, year }: MonthColumnOptions): readonly ColumnOption<MonthCode>[] =>
  calendar.monthsInYear(year).map((monthCode) => {
    const month = { monthCode, year };
    const monthStart = firstEpochDayOfMonth(calendar, month);
    const monthEnd = monthStart + daysInVisibleMonth(calendar, month) - 1;
    return {
      isDisabled: isInvertedBounds(bounds) || monthStart > bounds.max || monthEnd < bounds.min,
      label: locale.formatMonthName(month, calendar.id),
      value: monthCode,
    };
  });

const buildDayColumn = ({
  bounds,
  calendar,
  constraints,
  month,
}: DayColumnOptions): readonly ColumnOption<number>[] => {
  const monthStart = firstEpochDayOfMonth(calendar, month);
  return Array.from({ length: daysInVisibleMonth(calendar, month) }, (_, index) => {
    const epochDay = brandEpochDay(monthStart + index);
    const isDisabled =
      isInvertedBounds(bounds) ||
      epochDay < bounds.min ||
      epochDay > bounds.max ||
      constraints.isEpochDayDisabled(epochDay);
    return { isDisabled, label: String(index + 1), value: index + 1 };
  });
};

const buildTimeOption = (value: number): ColumnOption<number> => ({
  isDisabled: false,
  label: padDigits(value, TIME_PART_DIGITS),
  value,
});
