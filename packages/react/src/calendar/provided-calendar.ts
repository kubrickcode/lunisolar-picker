import { type CalendarId, type CalendarSystem, gregory } from '@lunisolar-picker/calendar';

export const isCalendarProvided = (calendars: readonly CalendarSystem[], calendarId: CalendarId): boolean =>
  calendars.some((candidate) => candidate.id === calendarId);

// Constraint: 렌더 중에 던지지 않음. 주지 않은(또는 앱이 뺀) 역법은 양력으로 대신함 (preflight 3.5)
export const providedCalendarOf = (calendars: readonly CalendarSystem[], calendarId: CalendarId): CalendarSystem =>
  calendars.find((candidate) => candidate.id === calendarId) ?? gregory;

// Goal: 앱이 뺀 역법으로 적힌 선택은 같은 날을 양력으로 옮겨 적음. 바뀐 게 없으면 같은 참조를 돌려줘 store가 그대로 남게 함
export const toProvidedCalendar = <Selected extends { readonly calendarId: CalendarId }>(
  selected: Selected | null,
  calendars: readonly CalendarSystem[],
): Selected | null =>
  selected === null || isCalendarProvided(calendars, selected.calendarId)
    ? selected
    : { ...selected, calendarId: gregory.id };
