import type { CalendarSystem, DateFields, SupportedRange } from '../calendar-system';
import { brandEpochDay, type EpochDay } from '../epoch-day';
import { LunisolarPickerError } from '../errors';
import { err, ok, type Result } from '../result';
import type { ValidationReason } from '../validation-reason';
import { decodeDangiYear } from './table-codec';
import { type DangiYearRecord, isTruncated, monthCodesOf } from './year-record';

export type DangiTable = {
  readonly firstYear: number;
  readonly lastEpochDay: EpochDay;
  readonly yearTable: readonly number[];
};

export const createDangiCalendar = (table: DangiTable): CalendarSystem => {
  const records = table.yearTable.map((encoded, index) => decodeDangiYear(table.firstYear + index, encoded));
  const firstRecord = records[0];
  if (!firstRecord) throw new LunisolarPickerError('dangi table is empty');
  const lastYear = table.firstYear + records.length - 1;
  const supportedRange: SupportedRange = { min: firstRecord.newYearEpochDay, max: table.lastEpochDay };

  const findRecord = (year: number): DangiYearRecord | undefined =>
    Number.isInteger(year) ? records[year - table.firstYear] : undefined;

  const requireRecord = (year: number): DangiYearRecord => {
    const record = findRecord(year);
    if (!record) {
      throw new LunisolarPickerError(`dangi supports lunar years ${table.firstYear}-${lastYear}, received ${year}`);
    }
    return record;
  };

  return {
    id: 'dangi',
    supportedRange,
    monthsInYear: (year) => monthCodesOf(requireRecord(year)),
    daysInMonth: (year, monthCode) => {
      const record = requireRecord(year);
      const days = record.monthLengths[monthCodesOf(record).indexOf(monthCode)];
      if (days === undefined) throw new LunisolarPickerError(`lunar year ${year} has no month ${monthCode}`);
      return days;
    },
    toEpochDay: (fields) => {
      const record = findRecord(fields.year);
      if (!record) return err('outside-calendar-range');
      return epochDayInRecord(record, fields);
    },
    fromEpochDay: (epochDay) => {
      if (epochDay < supportedRange.min || epochDay > supportedRange.max) return err('outside-calendar-range');
      return ok(fieldsInRecord(findRecordContaining(records, epochDay), epochDay));
    },
  };
};

const epochDayInRecord = (
  record: DangiYearRecord,
  { monthCode, day }: DateFields,
): Result<EpochDay, ValidationReason> => {
  const monthIndex = monthCodesOf(record).indexOf(monthCode);
  // Constraint: 데이터가 끝난 마지막 해의 뒤쪽 달은 실제로 있을 수 있으므로 '없는 날짜'가 아니라 '범위 밖'으로 알림
  if (monthIndex === -1) return err(isTruncated(record) ? 'outside-calendar-range' : 'invalid-date');
  const days = record.monthLengths[monthIndex] ?? 0;
  if (!Number.isInteger(day) || day < 1 || day > days) return err('invalid-date');
  const daysBeforeMonth = record.monthLengths.slice(0, monthIndex).reduce((total, length) => total + length, 0);
  return ok(brandEpochDay(record.newYearEpochDay + daysBeforeMonth + day - 1));
};

const findRecordContaining = (records: readonly DangiYearRecord[], epochDay: EpochDay): DangiYearRecord => {
  let lowIndex = 0;
  let highIndex = records.length - 1;
  while (lowIndex < highIndex) {
    const middleIndex = Math.ceil((lowIndex + highIndex) / 2);
    const middleRecord = records[middleIndex];
    if (middleRecord && middleRecord.newYearEpochDay <= epochDay) lowIndex = middleIndex;
    else highIndex = middleIndex - 1;
  }
  const record = records[lowIndex];
  if (!record) throw new LunisolarPickerError(`no lunar year contains epoch day ${epochDay}`);
  return record;
};

const fieldsInRecord = (record: DangiYearRecord, epochDay: EpochDay): DateFields => {
  const monthCodes = monthCodesOf(record);
  let remainingDays = epochDay - record.newYearEpochDay;
  for (const [index, days] of record.monthLengths.entries()) {
    const monthCode = monthCodes[index];
    if (monthCode && remainingDays < days) return { year: record.year, monthCode, day: remainingDays + 1 };
    remainingDays -= days;
  }
  throw new LunisolarPickerError(`epoch day ${epochDay} is past the known months of lunar year ${record.year}`);
};
