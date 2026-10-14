import { LunisolarPickerError } from './errors';

type MonthNumberCode = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';

// Goal: Temporal monthCode와 같은 표기. 윤달은 L 접미사 (예: M04L = 윤4월)
export type MonthCode = `M${MonthNumberCode}` | `M${MonthNumberCode}L`;

export interface MonthCodeParts {
  readonly month: number;
  readonly isLeapMonth: boolean;
}

const MONTH_CODE_PATTERN = /^M(0[1-9]|1[0-2])(L?)$/;
const FIRST_MONTH = 1;
const LAST_MONTH = 12;

export function isMonthCode(value: string): value is MonthCode {
  return MONTH_CODE_PATTERN.test(value);
}

export function toMonthCode(month: number, isLeapMonth: boolean): MonthCode {
  if (!Number.isInteger(month) || month < FIRST_MONTH || month > LAST_MONTH) {
    throw new LunisolarPickerError(`month must be an integer from 1 to 12, received ${month}`);
  }
  return `M${String(month).padStart(2, '0')}${isLeapMonth ? 'L' : ''}` as MonthCode;
}

export function parseMonthCode(monthCode: MonthCode): MonthCodeParts {
  const match = MONTH_CODE_PATTERN.exec(monthCode);
  if (!match) throw new LunisolarPickerError(`invalid month code: ${monthCode}`);
  return { month: Number(match[1]), isLeapMonth: match[2] === 'L' };
}
