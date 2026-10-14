import type { EpochDay } from '../epoch-day';
import { type MonthCode, toMonthCode } from '../month-code';

const NO_LEAP_MONTH = 0;
const REGULAR_MONTH_COUNT = 12;
const REGULAR_MONTH_NUMBERS = Array.from({ length: REGULAR_MONTH_COUNT }, (_, index) => index + 1);

export interface DangiYearRecord {
  readonly year: number;
  readonly newYearEpochDay: EpochDay;
  readonly leapMonth: number;
  readonly monthLengths: readonly number[];
}

export const expectedMonthCount = (record: Pick<DangiYearRecord, 'leapMonth'>): number =>
  record.leapMonth === NO_LEAP_MONTH ? REGULAR_MONTH_COUNT : REGULAR_MONTH_COUNT + 1;

// Goal: KASI 데이터가 끝나는 마지막 음력 해는 뒤쪽 달 정보가 없음. 그 달은 '없는 날짜'가 아니라 '지원 범위 밖'으로 다뤄야 함
export const isTruncated = (record: DangiYearRecord): boolean =>
  record.monthLengths.length < expectedMonthCount(record);

export const monthCodesOf = (record: DangiYearRecord): readonly MonthCode[] =>
  REGULAR_MONTH_NUMBERS.flatMap((month) => monthCodesForMonth(month, record.leapMonth)).slice(
    0,
    record.monthLengths.length,
  );

const monthCodesForMonth = (month: number, leapMonth: number): readonly MonthCode[] =>
  month === leapMonth ? [toMonthCode(month, false), toMonthCode(month, true)] : [toMonthCode(month, false)];
