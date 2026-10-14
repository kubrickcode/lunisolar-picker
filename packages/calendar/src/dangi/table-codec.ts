import { brandEpochDay, epochDayFromCivil } from '../epoch-day';
import { LunisolarPickerError } from '../errors';
import { type DangiYearRecord, expectedMonthCount } from './year-record';

// Goal: 1900~2050년 표를 gzip 1KB 안팎에 담기 위해 한 해를 정수 하나로 압축함 (스펙 5.3)
// 비트 배치: [0..5] 1월 1일부터 설날까지 일수, [6..18] 달별 대(30)·소(29), [19..22] 윤달 번호, [23..26] 알려진 달 수
// Constraint: 아래 상수는 의존 순서대로 선언해야 함 (뒤 상수가 앞 상수 값을 사용)
const NEW_YEAR_OFFSET_BITS = 6;
const MONTH_LENGTH_BITS = 13;
const LEAP_MONTH_BITS = 4;
const MONTH_COUNT_BITS = 4;
const MONTH_LENGTH_SHIFT = NEW_YEAR_OFFSET_BITS;
const LEAP_MONTH_SHIFT = MONTH_LENGTH_SHIFT + MONTH_LENGTH_BITS;
const MONTH_COUNT_SHIFT = LEAP_MONTH_SHIFT + LEAP_MONTH_BITS;
const NEW_YEAR_OFFSET_MASK = (1 << NEW_YEAR_OFFSET_BITS) - 1;
const MONTH_LENGTH_MASK = (1 << MONTH_LENGTH_BITS) - 1;
const LEAP_MONTH_MASK = (1 << LEAP_MONTH_BITS) - 1;
const MONTH_COUNT_MASK = (1 << MONTH_COUNT_BITS) - 1;
const LONG_MONTH_DAYS = 30;
const SHORT_MONTH_DAYS = 29;
const LAST_LEAP_MONTH = 12;

export const encodeDangiYear = (record: DangiYearRecord): number => {
  const newYearOffset = record.newYearEpochDay - epochDayFromCivil(record.year, 1, 1);
  assertEncodable(record, newYearOffset);
  const monthLengthBits = record.monthLengths.reduce(
    (bits, days, index) => (days === LONG_MONTH_DAYS ? bits | (1 << index) : bits),
    0,
  );
  return (
    newYearOffset |
    (monthLengthBits << MONTH_LENGTH_SHIFT) |
    (record.leapMonth << LEAP_MONTH_SHIFT) |
    (record.monthLengths.length << MONTH_COUNT_SHIFT)
  );
};

export const decodeDangiYear = (year: number, encoded: number): DangiYearRecord => {
  const newYearOffset = encoded & NEW_YEAR_OFFSET_MASK;
  const monthLengthBits = (encoded >> MONTH_LENGTH_SHIFT) & MONTH_LENGTH_MASK;
  const leapMonth = (encoded >> LEAP_MONTH_SHIFT) & LEAP_MONTH_MASK;
  const monthCount = (encoded >> MONTH_COUNT_SHIFT) & MONTH_COUNT_MASK;
  return {
    year,
    newYearEpochDay: brandEpochDay(epochDayFromCivil(year, 1, 1) + newYearOffset),
    leapMonth,
    monthLengths: Array.from({ length: monthCount }, (_, index) =>
      (monthLengthBits >> index) & 1 ? LONG_MONTH_DAYS : SHORT_MONTH_DAYS,
    ),
  };
};

const assertEncodable = (record: DangiYearRecord, newYearOffset: number): void => {
  const problems = [
    newYearOffset < 0 || newYearOffset > NEW_YEAR_OFFSET_MASK ? `new year offset ${newYearOffset} is outside 0-63` : '',
    !Number.isInteger(record.leapMonth) || record.leapMonth < 0 || record.leapMonth > LAST_LEAP_MONTH
      ? `leap month ${record.leapMonth} is outside 0-12`
      : '',
    record.monthLengths.length === 0 || record.monthLengths.length > expectedMonthCount(record)
      ? `month count ${record.monthLengths.length} does not fit leap month ${record.leapMonth}`
      : '',
    record.monthLengths.some((days) => days !== LONG_MONTH_DAYS && days !== SHORT_MONTH_DAYS)
      ? `month lengths must be 29 or 30: ${record.monthLengths.join(',')}`
      : '',
  ].filter((problem) => problem !== '');
  if (problems.length > 0) {
    throw new LunisolarPickerError(`cannot encode lunar year ${record.year}: ${problems.join('; ')}`);
  }
};
