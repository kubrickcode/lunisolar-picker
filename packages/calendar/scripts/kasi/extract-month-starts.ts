import { epochDayFromCivil } from '../../src/epoch-day';
import { isoDateToEpochDay, toIsoDate } from './iso-date';
import type { KasiDayItem, KasiMonthStart } from './kasi-types';

const FIRST_LUNAR_DAY = 1;
const VALID_MONTH_LENGTHS: ReadonlySet<number> = new Set([29, 30]);

export const extractMonthStarts = (items: readonly KasiDayItem[]): KasiMonthStart[] => {
  const monthStarts = [...items]
    .sort((first, second) => solarEpochDayOf(first) - solarEpochDayOf(second))
    .filter((item) => item.lunarDay === FIRST_LUNAR_DAY)
    .map((item) => ({
      lunarYear: item.lunarYear,
      lunarMonth: item.lunarMonth,
      isLeapMonth: item.isLeapMonth,
      days: item.lunarMonthDays,
      solarStart: toIsoDate(item.solarDate),
    }));
  assertMonthLengths(monthStarts);
  assertContiguous(monthStarts);
  return monthStarts;
};

const solarEpochDayOf = (item: KasiDayItem): number =>
  epochDayFromCivil(item.solarDate.year, item.solarDate.month, item.solarDate.day);

const assertMonthLengths = (monthStarts: readonly KasiMonthStart[]): void => {
  const invalid = monthStarts.find((start) => !VALID_MONTH_LENGTHS.has(start.days));
  if (invalid)
    throw new Error(`lunar month starting ${invalid.solarStart} has ${invalid.days} days; expected 29 or 30`);
};

// Constraint: 한 달이라도 빠지면 그 뒤 모든 날짜가 어긋나므로 시작일 간격이 직전 달 길이와 정확히 같아야 함
const assertContiguous = (monthStarts: readonly KasiMonthStart[]): void => {
  monthStarts.reduce<KasiMonthStart | undefined>((previous, current) => {
    if (previous) assertFollows(previous, current);
    return current;
  }, undefined);
};

const assertFollows = (previous: KasiMonthStart, current: KasiMonthStart): void => {
  const expectedStart = isoDateToEpochDay(previous.solarStart) + previous.days;
  if (isoDateToEpochDay(current.solarStart) !== expectedStart) {
    throw new Error(
      `lunar month starting ${current.solarStart} does not follow ${previous.solarStart} (+${previous.days} days)`,
    );
  }
};
