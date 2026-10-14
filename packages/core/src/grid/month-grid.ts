import {
  brandEpochDay,
  type CalendarId,
  type CalendarSystem,
  civilFromEpochDay,
  type DateString,
  type EpochDay,
  formatDate,
  gregory,
  isWithinSupportedRange,
  parseMonthCode,
  weekdayOf,
} from '@lunisolar-picker/calendar';
import { padDigits } from '../format-digits';
import { type SecondaryDateLabel, toWeekday, type VisibleMonth, type Weekday } from '../types';
import { daysInVisibleMonth, firstEpochDayOfMonth } from './calendar-math';

const DAYS_PER_WEEK = 7;
// Constraint: 달마다 줄 수가 바뀌면 팝오버 높이가 흔들리므로 항상 6주를 그림
const WEEKS_PER_GRID = 6;

export interface MonthGridCell {
  readonly epochDay: EpochDay;
  readonly date: DateString;
  readonly day: number;
  readonly weekday: Weekday;
  readonly isOutsideMonth: boolean;
  readonly isOutsideSupportedRange: boolean;
  readonly secondary: SecondaryDateLabel | null;
}

export interface MonthGrid {
  readonly calendarId: CalendarId;
  readonly month: VisibleMonth;
  readonly weeks: readonly (readonly MonthGridCell[])[];
}

export interface BuildMonthGridOptions {
  readonly calendar: CalendarSystem;
  readonly month: VisibleMonth;
  readonly weekStartsOn: Weekday;
  readonly secondaryCalendar: CalendarSystem | null;
}

export const buildMonthGrid = (options: BuildMonthGridOptions): MonthGrid => {
  const { calendar, month, weekStartsOn, secondaryCalendar } = options;
  const firstDay = firstEpochDayOfMonth(calendar, month);
  const lastDay = firstDay + daysInVisibleMonth(calendar, month) - 1;
  const leadingDayCount = (weekdayOf(firstDay) - weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const gridStart = firstDay - leadingDayCount;
  const weeks = Array.from({ length: WEEKS_PER_GRID }, (_, weekIndex) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
      const epochDay = brandEpochDay(gridStart + weekIndex * DAYS_PER_WEEK + dayIndex);
      return buildCell({
        calendar,
        epochDay,
        isInMonth: epochDay >= firstDay && epochDay <= lastDay,
        secondaryCalendar,
      });
    }),
  );
  return { calendarId: calendar.id, month, weeks };
};

type BuildCellOptions = {
  readonly calendar: CalendarSystem;
  readonly epochDay: EpochDay;
  readonly isInMonth: boolean;
  readonly secondaryCalendar: CalendarSystem | null;
};

const buildCell = ({ calendar, epochDay, isInMonth, secondaryCalendar }: BuildCellOptions): MonthGridCell => {
  const displayFields = calendar.fromEpochDay(epochDay);
  return {
    epochDay,
    date: dateStringOf(epochDay),
    day: displayFields.isOk ? displayFields.value.day : civilFromEpochDay(epochDay).day,
    weekday: toWeekday(weekdayOf(epochDay)),
    isOutsideMonth: !isInMonth,
    isOutsideSupportedRange: !displayFields.isOk || !isWithinSupportedRange(gregory, epochDay),
    secondary: secondaryCalendar === null ? null : secondaryLabelOf(secondaryCalendar, epochDay),
  };
};

// Constraint: 6주 격자의 앞뒤 칸은 양력 지원 범위(0001-01-01) 밖일 수 있음. 그 칸은 선택 불가(isOutsideSupportedRange)라 형식만 맞춘 문자열을 둠
const dateStringOf = (epochDay: EpochDay): DateString => {
  const formatted = formatDate(epochDay);
  if (formatted.isOk) return formatted.value;
  const { year, month, day } = civilFromEpochDay(epochDay);
  return `${padDigits(year, 4)}-${padDigits(month, 2)}-${padDigits(day, 2)}` as DateString; // as: 양력 범위 밖 격자 칸 — 선택 불가 칸에 형식만 맞춘 문자열
};

const secondaryLabelOf = (calendar: CalendarSystem, epochDay: EpochDay): SecondaryDateLabel | null => {
  const fields = calendar.fromEpochDay(epochDay);
  if (!fields.isOk) return null;
  return {
    calendarId: calendar.id,
    monthCode: fields.value.monthCode,
    day: fields.value.day,
    isLeapMonth: parseMonthCode(fields.value.monthCode).isLeapMonth,
    isFirstDayOfMonth: fields.value.day === 1,
  };
};
