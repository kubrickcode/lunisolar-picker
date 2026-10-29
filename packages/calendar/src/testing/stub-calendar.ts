import type { CalendarId, CalendarSystem, DateFields, SupportedRange } from '../calendar-system';
import { err, ok } from '../result';

export type StubCalendarOptions = {
  readonly id: CalendarId;
  readonly supportedRange: SupportedRange;
  readonly fields: DateFields;
};

// Goal: 값 모듈이 표기된 역법에서 필드를 가져오는지 dangi 데이터 없이 확인하려는 고정 응답 역법
export const createStubCalendar = (options: StubCalendarOptions): CalendarSystem => {
  const { min, max } = options.supportedRange;
  return {
    id: options.id,
    supportedRange: options.supportedRange,
    monthsInYear: () => [options.fields.monthCode],
    daysInMonth: () => 30,
    toEpochDay: () => ok(min),
    fromEpochDay: (epochDay) => (epochDay < min || epochDay > max ? err('outside-calendar-range') : ok(options.fields)),
  };
};
