import { LunisolarPickerError } from './errors';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;
const MONTH_CODE_PATTERN = /^M(0[1-9]|1[0-2])(L?)$/;

type MonthNumberCode = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';

// Goal: Temporal monthCode와 같은 표기. 윤달은 L 접미사 (예: M04L = 윤4월)
export type MonthCode = `M${MonthNumberCode}` | `M${MonthNumberCode}L`;

export interface MonthCodeParts {
  readonly month: number;
  readonly isLeapMonth: boolean;
}

export const toMonthCode = (month: number, isLeapMonth: boolean): MonthCode => {
  if (!Number.isInteger(month) || month < FIRST_MONTH || month > LAST_MONTH) {
    throw new LunisolarPickerError(`month must be an integer from 1 to 12, received ${month}`);
  }
  const value = `M${String(month).padStart(2, '0')}${isLeapMonth ? 'L' : ''}`;
  return value as MonthCode; // as: 템플릿 리터럴 — 두 자리 월과 선택적 L 접미사가 구조상 MonthCode와 일치함
};

export const isMonthCode = (value: string): value is MonthCode => MONTH_CODE_PATTERN.test(value);

export const parseMonthCode = (monthCode: MonthCode): MonthCodeParts => {
  const match = MONTH_CODE_PATTERN.exec(monthCode);
  if (!match) throw new LunisolarPickerError(`invalid month code: ${monthCode}`);
  return { month: Number(match[1]), isLeapMonth: match[2] === 'L' };
};
