import type { CalendarSystem, EpochDay, MonthCode } from '@lunisolar-picker/calendar';
import type { VisibleMonth } from '../types';
import { clampEpochDay, fieldsOf, firstEpochDayOfMonth, supportedYearRange } from './calendar-math';

export const shiftVisibleMonth = (calendar: CalendarSystem, month: VisibleMonth, amount: number): VisibleMonth => {
  const step = amount < 0 ? -1 : 1;
  let current = month;
  for (let moved = 0; moved < Math.abs(amount); moved += 1) {
    const adjacent = adjacentMonth({ calendar, month: current, step });
    if (adjacent === null) break;
    current = adjacent;
  }
  return current;
};

export const compareVisibleMonths = (calendar: CalendarSystem, first: VisibleMonth, second: VisibleMonth): number =>
  firstEpochDayOfMonth(calendar, first) - firstEpochDayOfMonth(calendar, second);

export const isSameVisibleMonth = (first: VisibleMonth, second: VisibleMonth): boolean =>
  first.year === second.year && first.monthCode === second.monthCode;

export const listMonthsOfYear = (calendar: CalendarSystem, year: number): readonly VisibleMonth[] =>
  calendar.monthsInYear(year).map((monthCode) => ({ year, monthCode }));

export const listYearPage = (calendar: CalendarSystem, pageStart: number, pageSize: number): readonly number[] => {
  const { firstYear, lastYear } = supportedYearRange(calendar);
  return Array.from({ length: pageSize }, (_, index) => pageStart + index).filter(
    (year) => year >= firstYear && year <= lastYear,
  );
};

export const visibleMonthOf = (calendar: CalendarSystem, epochDay: EpochDay): VisibleMonth => {
  const { year, monthCode } = fieldsOf(calendar, clampEpochDay(epochDay, calendar.supportedRange));
  return { year, monthCode };
};

export const yearPageStartOf = (year: number, pageSize: number): number =>
  year - (((year % pageSize) + pageSize) % pageSize);

type AdjacentMonthOptions = {
  readonly calendar: CalendarSystem;
  readonly month: VisibleMonth;
  readonly step: 1 | -1;
};

// Constraint: 범위 밖 연도에 monthsInYear를 부르면 프로그래머 오류로 던지므로 지원 연도를 먼저 확인함
const adjacentMonth = ({ calendar, month, step }: AdjacentMonthOptions): VisibleMonth | null => {
  const monthCodes = calendar.monthsInYear(month.year);
  const sameYearCode = monthCodes[monthCodes.indexOf(month.monthCode) + step];
  if (sameYearCode !== undefined) return { year: month.year, monthCode: sameYearCode };
  const { firstYear, lastYear } = supportedYearRange(calendar);
  const year = month.year + step;
  if (year < firstYear || year > lastYear) return null;
  const nextYearCodes = calendar.monthsInYear(year);
  const edgeCode: MonthCode | undefined = step > 0 ? nextYearCodes[0] : nextYearCodes.at(-1);
  return edgeCode === undefined ? null : { year, monthCode: edgeCode };
};
