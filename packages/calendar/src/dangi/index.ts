import type { CalendarSystem } from '../calendar-system';
import { createDangiCalendar } from './dangi-calendar';
import { DANGI_FIRST_YEAR, DANGI_LAST_EPOCH_DAY, DANGI_YEAR_TABLE } from './dangi-table.generated';

export const dangi: CalendarSystem = /* @__PURE__ */ createDangiCalendar({
  firstYear: DANGI_FIRST_YEAR,
  lastEpochDay: DANGI_LAST_EPOCH_DAY,
  yearTable: DANGI_YEAR_TABLE,
});
