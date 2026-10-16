import { type CalendarSystem, type DateString, parseDate, type ValidationReason } from '@lunisolar-picker/calendar';
import { type DateConstraints, VALID, type Validity, validateDate } from '@lunisolar-picker/core';

const EMPTY_VALUE: ParsedDateValue = { invalidReason: null, value: null };

export type ParsedDateValue = {
  readonly invalidReason: ValidationReason | null;
  readonly value: DateString | null;
};

type DateValidityInput = {
  readonly calendars: readonly CalendarSystem[];
  readonly constraints: DateConstraints;
  readonly value: DateString | null;
};

// Constraint: 완전히 빈 값은 required여도 VALID로 알림. required는 aria-required와 네이티브 required 검증만 맡음 (M3 입력 부품과 같음)
export const dateValidityOf = ({ calendars, constraints, value }: DateValidityInput): Validity => {
  if (value === null) return VALID;
  const { isValid, reasons } = validateDate(value, constraints, { calendars });
  return { isValid, reasons };
};

export const parseDateValue = (value: string | null, calendars: readonly CalendarSystem[]): ParsedDateValue => {
  if (!value) return EMPTY_VALUE;
  const parsed = parseDate(value, { calendars });
  return parsed.isOk
    ? { invalidReason: null, value: parsed.value.value }
    : { invalidReason: parsed.error, value: null };
};
