import type { CivilDate } from '../../src/epoch-day';

export type KasiDayItem = {
  readonly solarDate: CivilDate;
  readonly lunarYear: number;
  readonly lunarMonth: number;
  readonly lunarDay: number;
  readonly isLeapMonth: boolean;
  readonly lunarMonthDays: number;
};

export type KasiMonthStart = {
  readonly lunarYear: number;
  readonly lunarMonth: number;
  readonly isLeapMonth: boolean;
  readonly days: number;
  readonly solarStart: string;
};

export type KasiDataFile = {
  readonly source: string;
  readonly collectedAt: string;
  readonly solarRange: { readonly from: string; readonly to: string };
  readonly monthStarts: readonly KasiMonthStart[];
};
