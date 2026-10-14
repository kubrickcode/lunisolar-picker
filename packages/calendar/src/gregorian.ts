import type { CalendarSystem, SupportedRange } from './calendar-system';
import { civilFromEpochDay, daysInGregorianMonth, epochDayFromCivil } from './epoch-day';
import { LunisolarPickerError } from './errors';
import { isMonthCode, type MonthCode, parseMonthCode, toMonthCode } from './month-code';
import { err, ok } from './result';

const FIRST_YEAR = 1;
const LAST_YEAR = 9999;
const MONTHS_PER_YEAR = 12;

const GREGORIAN_MONTH_CODES: readonly MonthCode[] = Array.from({ length: MONTHS_PER_YEAR }, (_, index) =>
  toMonthCode(index + 1, false),
);

const SUPPORTED_RANGE: SupportedRange = {
  min: epochDayFromCivil(FIRST_YEAR, 1, 1),
  max: epochDayFromCivil(LAST_YEAR, 12, 31),
};

function isSupportedYear(year: number): boolean {
  return Number.isInteger(year) && year >= FIRST_YEAR && year <= LAST_YEAR;
}

function assertSupportedYear(year: number): void {
  if (!isSupportedYear(year)) {
    throw new LunisolarPickerError(`gregory supports years ${FIRST_YEAR}-${LAST_YEAR}, received ${year}`);
  }
}

export const gregory: CalendarSystem = {
  id: 'gregory',
  supportedRange: SUPPORTED_RANGE,
  monthsInYear(year) {
    assertSupportedYear(year);
    return GREGORIAN_MONTH_CODES;
  },
  daysInMonth(year, monthCode) {
    assertSupportedYear(year);
    const { month, isLeapMonth } = parseMonthCode(monthCode);
    if (isLeapMonth) throw new LunisolarPickerError(`gregory has no leap month: ${monthCode}`);
    return daysInGregorianMonth(year, month);
  },
  toEpochDay({ year, monthCode, day }) {
    if (!isSupportedYear(year)) return err('outside-calendar-range');
    if (!isMonthCode(monthCode)) return err('invalid-date');
    const { month, isLeapMonth } = parseMonthCode(monthCode);
    const isValidDay = Number.isInteger(day) && day >= 1 && day <= daysInGregorianMonth(year, month);
    if (isLeapMonth || !isValidDay) return err('invalid-date');
    return ok(epochDayFromCivil(year, month, day));
  },
  fromEpochDay(epochDay) {
    if (epochDay < SUPPORTED_RANGE.min || epochDay > SUPPORTED_RANGE.max) return err('outside-calendar-range');
    const { year, month, day } = civilFromEpochDay(epochDay);
    return ok({ year, monthCode: toMonthCode(month, false), day });
  },
};
