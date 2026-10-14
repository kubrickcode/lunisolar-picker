declare const epochDayBrand: unique symbol;

// Goal: 비교·범위·역법 변환을 모두 정수 하나로 계산하기 위한 정규 표현 (스펙 4.3)
export type EpochDay = number & { readonly [epochDayBrand]: true };

export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const DAYS_PER_ERA = 146_097;
const DAYS_FROM_ERA_START_TO_EPOCH = 719_468;
const YEARS_PER_ERA = 400;
const DAYS_PER_WEEK = 7;
const EPOCH_WEEKDAY = 4;
const GREGORIAN_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

// Constraint: 3월 시작 연도로 바꿔 윤일을 연말에 두는 Howard Hinnant의 days_from_civil 알고리즘. 음수 연도·epoch 이전 날짜도 정확해야 함
export function epochDayFromCivil(year: number, month: number, day: number): EpochDay {
  const marchBasedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(marchBasedYear / YEARS_PER_ERA);
  const yearOfEra = marchBasedYear - era * YEARS_PER_ERA;
  const marchBasedMonth = month > 2 ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * marchBasedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return (era * DAYS_PER_ERA + dayOfEra - DAYS_FROM_ERA_START_TO_EPOCH) as EpochDay;
}

export function civilFromEpochDay(epochDay: EpochDay): CivilDate {
  const shiftedDay = epochDay + DAYS_FROM_ERA_START_TO_EPOCH;
  const era = Math.floor(shiftedDay / DAYS_PER_ERA);
  const dayOfEra = shiftedDay - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const marchBasedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * marchBasedMonth + 2) / 5) + 1;
  const month = marchBasedMonth < 10 ? marchBasedMonth + 3 : marchBasedMonth - 9;
  const year = yearOfEra + era * YEARS_PER_ERA + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

export function weekdayOf(epochDay: EpochDay): number {
  return (((epochDay + EPOCH_WEEKDAY) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

export function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2 && isGregorianLeapYear(year)) return 29;
  return GREGORIAN_MONTH_DAYS[month - 1] ?? 0;
}
