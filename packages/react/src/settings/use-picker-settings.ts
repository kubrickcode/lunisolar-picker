import { type CalendarSystem, type EpochDay, gregory } from '@lunisolar-picker/calendar';
import type { LocaleData, Weekday } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { useContext, useMemo } from 'react';
import { useToday } from '../today/use-today';
import { LunisolarSettingsContext } from './lunisolar-provider';
import type { SharedPickerProps } from './shared-picker-props';

const CALENDAR_KEY_SEPARATOR = ',';

export type PickerSettings = {
  readonly calendars: readonly CalendarSystem[];
  readonly locale: LocaleData;
  readonly timeZone: string | undefined;
  readonly todayEpochDay: EpochDay;
  readonly weekStartsOn: Weekday;
};

export const usePickerSettings = (props: SharedPickerProps): PickerSettings => {
  const provided = useContext(LunisolarSettingsContext);
  const locale = props.locale ?? provided.locale ?? en;
  const timeZone = props.timeZone ?? provided.timeZone;
  const todayEpochDay = useToday(timeZone, props.today ?? provided.today);
  const weekStartsOn = props.weekStartsOn ?? provided.weekStartsOn ?? locale.weekStartsOn;
  const requestedCalendars = props.calendars ?? provided.calendars;
  // Goal: 인라인 `calendars={[dangi]}`가 렌더마다 새 배열이어도 같은 역법 구성이면 같은 참조를 유지함
  const calendarKey = withGregorian(requestedCalendars)
    .map((calendar) => calendar.id)
    .join(CALENDAR_KEY_SEPARATOR);
  // biome-ignore lint/correctness/useExhaustiveDependencies: calendarKey가 구성의 동일성을 대표함
  const calendars = useMemo(() => withGregorian(requestedCalendars), [calendarKey]);
  return useMemo(
    () => ({ calendars, locale, timeZone, todayEpochDay, weekStartsOn }),
    [calendars, locale, timeZone, todayEpochDay, weekStartsOn],
  );
};

// Constraint: 양력은 항상 첫 번째. 화면 기본값과 값 해석의 기준이 되기 때문 (계약 §2.2)
export const withGregorian = (calendars: readonly CalendarSystem[] | undefined): readonly CalendarSystem[] => {
  const others = (calendars ?? []).filter((calendar) => calendar.id !== gregory.id);
  const uniqueOthers = others.filter(
    (calendar, index) => others.findIndex((other) => other.id === calendar.id) === index,
  );
  return [gregory, ...uniqueOthers];
};
