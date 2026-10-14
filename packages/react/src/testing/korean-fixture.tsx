import { type CalendarSystem, type EpochDay, gregory, parseDate, weekdayOf } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { toWeekday } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement, ReactNode } from 'react';
import { LunisolarProvider } from '../settings/lunisolar-provider';

export const FIXED_TODAY = '2026-10-14';

export type KoreanProviderProps = {
  readonly children: ReactNode;
  readonly hasLunar?: boolean | undefined;
};

export const KoreanProvider = ({ children, hasLunar = false }: KoreanProviderProps): ReactElement => (
  <LunisolarProvider
    locale={ko}
    timeZone="Asia/Seoul"
    today={FIXED_TODAY}
    weekStartsOn={0}
    calendars={hasLunar ? [dangi] : []}
  >
    {children}
  </LunisolarProvider>
);

export const dayLabel = (isoDate: string, calendar: CalendarSystem = gregory): string => {
  const epochDay = epochDayAt(isoDate);
  const fields = calendar.fromEpochDay(epochDay);
  if (!fields.isOk) throw new Error(`${isoDate} is outside ${calendar.id}`);
  return ko.formatDayLabel(fields.value, toWeekday(weekdayOf(epochDay)), calendar.id);
};

export const epochDayAt = (isoDate: string): EpochDay => {
  const parsed = parseDate(isoDate);
  if (!parsed.isOk) throw new Error(`fixture expects a canonical date, received ${isoDate}`);
  return parsed.value.epochDay;
};
