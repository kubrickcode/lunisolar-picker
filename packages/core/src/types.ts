import {
  type CalendarId,
  type EpochDay,
  LunisolarPickerError,
  type MonthCode,
  VALIDATION_REASONS,
  type ValidationReason,
} from '@lunisolar-picker/calendar';

const DAYS_PER_WEEK = 7;

export const VALID: Validity = { isValid: true, reasons: [] };

export type CommitMode = 'immediate' | 'confirm';
export type DateSegmentKind = 'year' | 'month' | 'day';
export type TimeSegmentKind = 'hour' | 'minute';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface EpochRange {
  readonly start: EpochDay;
  readonly end: EpochDay | null;
}

export interface SecondaryDateLabel {
  readonly calendarId: CalendarId;
  readonly day: number;
  readonly isFirstDayOfMonth: boolean;
  readonly isLeapMonth: boolean;
  readonly monthCode: MonthCode;
}

export interface Validity {
  readonly isValid: boolean;
  readonly reasons: readonly ValidationReason[];
}

export interface VisibleMonth {
  readonly monthCode: MonthCode;
  readonly year: number;
}

// Goal: 같은 이유 묶음이면 순서까지 같게 해서 테스트·화면 문구가 결정적이 되도록 함
export const invalidBecause = (reasons: Iterable<ValidationReason>): Validity => {
  const reasonSet = new Set(reasons);
  if (reasonSet.size === 0) return VALID;
  return { isValid: false, reasons: VALIDATION_REASONS.filter((reason) => reasonSet.has(reason)) };
};

export const toWeekday = (value: number): Weekday => {
  if (!Number.isInteger(value) || value < 0 || value >= DAYS_PER_WEEK) {
    throw new LunisolarPickerError(`weekday must be an integer from 0 to 6, received ${value}`);
  }
  return value as Weekday; // as: 0~6 정수임을 위에서 검증함
};
