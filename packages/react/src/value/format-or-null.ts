import { type CalendarSystem, type DateString, type EpochDay, formatDate } from '@lunisolar-picker/calendar';

// Constraint: 역법 지원 범위 밖 날짜는 확정 값으로 내보내지 않고 빈 값으로 둠
export const formatOrNull = (epochDay: EpochDay | null, calendar: CalendarSystem): DateString | null => {
  if (epochDay === null) return null;
  const formatted = formatDate(epochDay, calendar);
  return formatted.isOk ? formatted.value : null;
};
