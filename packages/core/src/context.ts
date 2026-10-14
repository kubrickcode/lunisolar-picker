import { type CalendarId, type CalendarSystem, type EpochDay, LunisolarPickerError } from '@lunisolar-picker/calendar';
import type { ResolvedConstraints } from './constraints/resolve-constraints';
import type { LocaleData } from './locales/locale-data';
import type { CommitMode, Weekday } from './types';

export interface PickerContext {
  readonly calendars: readonly CalendarSystem[];
  // Constraint: 양력 기준으로 해석한 제약. 표시 역법의 지원 범위는 리듀서가 boundsFor로 겹쳐 계산함 (상태↔컨텍스트 순환 방지)
  readonly constraints: ResolvedConstraints;
  readonly today: EpochDay;
  readonly weekStartsOn: Weekday;
  readonly locale: LocaleData;
  readonly commitMode: CommitMode;
  readonly numberOfMonths: number;
}

export const findCalendar = (calendars: readonly CalendarSystem[], calendarId: CalendarId): CalendarSystem => {
  const calendar = calendars.find((candidate) => candidate.id === calendarId);
  if (!calendar) throw new LunisolarPickerError(`calendar "${calendarId}" was not provided to the picker`);
  return calendar;
};
