import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import kasiData from '../../data/kasi-dangi-months.json';
import { buildYearRecords, DANGI_FIRST_YEAR, lastEpochDayOf } from '../../scripts/kasi/build-year-records';
import { isoDateToEpochDay } from '../../scripts/kasi/iso-date';
import type { KasiDataFile } from '../../scripts/kasi/kasi-types';
import { brandEpochDay, epochDayFromCivil } from '../epoch-day';
import { toMonthCode } from '../month-code';
import { DANGI_YEAR_TABLE } from './dangi-table.generated';
import { dangi } from './index';
import { encodeDangiYear } from './table-codec';

const dataFile = kasiData as KasiDataFile; // as: JSON import를 스크립트가 쓰는 데이터 파일 타입으로 좁힘
const supportedMonthStarts = dataFile.monthStarts.filter((start) => start.lunarYear >= DANGI_FIRST_YEAR);

describe('dangi against KASI data', () => {
  it('ships a table generated from the committed KASI data', () => {
    expect(buildYearRecords(dataFile.monthStarts, DANGI_FIRST_YEAR).map(encodeDangiYear)).toEqual(DANGI_YEAR_TABLE);
  });

  it('converts the first and last day of every KASI lunar month in both directions', () => {
    for (const start of supportedMonthStarts) {
      const monthCode = toMonthCode(start.lunarMonth, start.isLeapMonth);
      const firstDay = isoDateToEpochDay(start.solarStart);
      const lastDay = brandEpochDay(firstDay + start.days - 1);

      expect(dangi.toEpochDay({ year: start.lunarYear, monthCode, day: 1 })).toEqual({ isOk: true, value: firstDay });
      expect(dangi.fromEpochDay(firstDay)).toEqual({
        isOk: true,
        value: { year: start.lunarYear, monthCode, day: 1 },
      });
      expect(dangi.toEpochDay({ year: start.lunarYear, monthCode, day: start.days })).toEqual({
        isOk: true,
        value: lastDay,
      });
      expect(dangi.fromEpochDay(lastDay)).toEqual({
        isOk: true,
        value: { year: start.lunarYear, monthCode, day: start.days },
      });
    }
  });

  it('contains both 29-day and 30-day months and accepts day 30 only in long months', () => {
    const longMonth = supportedMonthStarts.find((start) => start.days === 30);
    const shortMonth = supportedMonthStarts.find((start) => start.days === 29);
    if (!longMonth || !shortMonth) throw new Error('KASI data should contain both month lengths');

    expect(
      dangi.toEpochDay({
        year: longMonth.lunarYear,
        monthCode: toMonthCode(longMonth.lunarMonth, longMonth.isLeapMonth),
        day: 30,
      }).isOk,
    ).toBe(true);
    expect(
      dangi.toEpochDay({
        year: shortMonth.lunarYear,
        monthCode: toMonthCode(shortMonth.lunarMonth, shortMonth.isLeapMonth),
        day: 30,
      }),
    ).toEqual({ isOk: false, error: 'invalid-date' });
  });

  // Constraint: 아래 기댓값은 Node Intl(ICU) 결과와 KASI가 일치한다고 본 표본. 실패하면 KASI가 정답이므로 데이터를 고치지 말고 차이를 사용자에게 보고
  it.each([
    ['2026-10-14', 2026, 'M09', 4],
    ['1990-06-23', 1990, 'M05L', 1],
    ['2025-07-25', 2025, 'M06L', 1],
    ['2025-08-22', 2025, 'M06L', 29],
    ['2026-02-17', 2026, 'M01', 1],
    ['2026-02-16', 2025, 'M12', 29],
    ['1900-01-31', 1900, 'M01', 1],
  ])('reads solar %s as lunar %i %s %i', (solarDate, year, monthCode, day) => {
    expect(dangi.fromEpochDay(isoDateToEpochDay(solarDate))).toEqual({ isOk: true, value: { year, monthCode, day } });
  });

  it('starts at the 1900 lunar new year and rejects the solar day before it', () => {
    expect(dangi.supportedRange.min).toBe(epochDayFromCivil(1900, 1, 31));
    expect(dangi.fromEpochDay(epochDayFromCivil(1900, 1, 30))).toEqual({
      isOk: false,
      error: 'outside-calendar-range',
    });
  });

  it('ends the supported range at the last KASI day', () => {
    expect(dangi.supportedRange.max).toBe(lastEpochDayOf(dataFile.monthStarts));
  });

  it('rejects the day after the last KASI day', () => {
    expect(dangi.fromEpochDay(brandEpochDay(dangi.supportedRange.max + 1))).toEqual({
      isOk: false,
      error: 'outside-calendar-range',
    });
  });

  it('round-trips every supported day', () => {
    fc.assert(
      fc.property(fc.integer({ min: dangi.supportedRange.min, max: dangi.supportedRange.max }), (value) => {
        const fields = dangi.fromEpochDay(brandEpochDay(value));
        if (!fields.isOk) return false;
        const back = dangi.toEpochDay(fields.value);
        return back.isOk && back.value === value;
      }),
    );
  });
});
