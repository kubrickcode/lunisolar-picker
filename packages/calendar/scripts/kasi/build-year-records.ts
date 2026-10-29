import { type DangiYearRecord, isTruncated, monthCodesOf } from '../../src/dangi/year-record';
import { toMonthCode } from '../../src/month-code';
import { isoDateToEpochDay } from './iso-date';
import type { KasiMonthStart } from './kasi-types';

export const DANGI_FIRST_YEAR = 1900;

export const buildYearRecords = (monthStarts: readonly KasiMonthStart[], firstYear: number): DangiYearRecord[] => {
  assertContiguousMonthStarts(monthStarts);
  const monthsByYear = groupByLunarYear(monthStarts.filter((start) => start.lunarYear >= firstYear));
  const years = [...monthsByYear.keys()];
  assertConsecutiveYears(years, firstYear);
  return years.map((year, index) => toYearRecord(year, monthsByYear.get(year) ?? [], index === years.length - 1));
};

export const lastEpochDayOf = (monthStarts: readonly KasiMonthStart[]): number => {
  const lastMonth = monthStarts.at(-1);
  if (!lastMonth) throw new Error('no lunar months to measure');
  return isoDateToEpochDay(lastMonth.solarStart) + lastMonth.days - 1;
};

const assertContiguousMonthStarts = (monthStarts: readonly KasiMonthStart[]): void =>
  monthStarts.forEach((start, index) => {
    const previous = monthStarts[index - 1];
    if (!previous) return;
    const expectedSolarStart = isoDateToEpochDay(previous.solarStart) + previous.days;
    if (isoDateToEpochDay(start.solarStart) !== expectedSolarStart) {
      throw new Error(`month start ${start.solarStart} does not follow ${previous.solarStart} + ${previous.days} days`);
    }
  });

const groupByLunarYear = (monthStarts: readonly KasiMonthStart[]): Map<number, KasiMonthStart[]> =>
  monthStarts.reduce((monthsByYear, start) => {
    monthsByYear.set(start.lunarYear, [...(monthsByYear.get(start.lunarYear) ?? []), start]);
    return monthsByYear;
  }, new Map<number, KasiMonthStart[]>());

const assertConsecutiveYears = (years: readonly number[], firstYear: number): void => {
  years.forEach((year, index) => {
    if (year !== firstYear + index) {
      throw new Error(`expected lunar year ${firstYear + index}, found ${year}`);
    }
  });
};

const toYearRecord = (year: number, months: readonly KasiMonthStart[], isLastYear: boolean): DangiYearRecord => {
  const firstMonth = months[0];
  if (firstMonth?.lunarMonth !== 1 || firstMonth?.isLeapMonth) {
    throw new Error(`lunar year ${year} does not start with month 1`);
  }
  const leapMonths = months.filter((month) => month.isLeapMonth);
  if (leapMonths.length > 1) throw new Error(`lunar year ${year} has ${leapMonths.length} leap months`);
  const record: DangiYearRecord = {
    year,
    newYearEpochDay: isoDateToEpochDay(firstMonth.solarStart),
    leapMonth: leapMonths[0]?.lunarMonth ?? 0,
    monthLengths: months.map((month) => month.days),
  };
  assertMonthOrder(record, months);
  if (!isLastYear && isTruncated(record)) {
    throw new Error(`lunar year ${year} has only ${months.length} months`);
  }
  return record;
};

const assertMonthOrder = (record: DangiYearRecord, months: readonly KasiMonthStart[]): void => {
  const actualCodes = months.map((month) => toMonthCode(month.lunarMonth, month.isLeapMonth));
  const expectedCodes = monthCodesOf(record);
  if (actualCodes.join() !== expectedCodes.join()) {
    throw new Error(`lunar year ${record.year} months are out of order: ${actualCodes.join(',')}`);
  }
};
