import type { CalendarSystem } from '@lunisolar-picker/calendar';
import type { LocaleData, MonthGridCell } from '@lunisolar-picker/core';

const LABEL_SEPARATOR = ', ';

export type CellLabelInput = {
  readonly appLabel: string | undefined;
  readonly calendar: CalendarSystem;
  readonly cell: MonthGridCell;
  readonly locale: LocaleData;
  readonly secondaryCalendar: CalendarSystem | null;
};

// Goal: 스크린리더가 전체 날짜 → 음력 → 앱 정보(공휴일 등) 순서로 읽게 함 (스펙 10.1)
export const buildCellLabel = ({ appLabel, calendar, cell, locale, secondaryCalendar }: CellLabelInput): string => {
  const primaryFields = calendar.fromEpochDay(cell.epochDay);
  const primary = primaryFields.isOk
    ? locale.formatDayLabel(primaryFields.value, cell.weekday, calendar.id)
    : cell.date;
  const secondaryFields = secondaryCalendar?.fromEpochDay(cell.epochDay);
  const secondary =
    secondaryCalendar && secondaryFields?.isOk
      ? [
          `${locale.calendarNames[secondaryCalendar.id]} ${locale.formatDateLabel(secondaryFields.value, secondaryCalendar.id)}`,
        ]
      : [];
  return [primary, ...secondary, ...(appLabel ? [appLabel] : [])].join(LABEL_SEPARATOR);
};
