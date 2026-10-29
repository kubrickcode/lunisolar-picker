import type { EpochDay } from './epoch-day';
import type { MonthCode } from './month-code';
import type { Result } from './result';
import type { ValidationReason } from './validation-reason';

export type CalendarId = 'gregory' | 'dangi';

export interface DateFields {
  readonly year: number;
  readonly monthCode: MonthCode;
  readonly day: number;
}

export interface SupportedRange {
  readonly min: EpochDay;
  readonly max: EpochDay;
}

// Goal: core·grid가 역법 종류를 분기하지 않고 이 계약에만 의존하게 함 (스펙 3.2, 5.1)
export interface CalendarSystem {
  readonly id: CalendarId;
  readonly supportedRange: SupportedRange;
  monthsInYear(year: number): readonly MonthCode[];
  daysInMonth(year: number, monthCode: MonthCode): number;
  toEpochDay(fields: DateFields): Result<EpochDay, ValidationReason>;
  fromEpochDay(epochDay: EpochDay): Result<DateFields, ValidationReason>;
}

export const isWithinSupportedRange = (calendar: CalendarSystem, epochDay: EpochDay): boolean =>
  epochDay >= calendar.supportedRange.min && epochDay <= calendar.supportedRange.max;
