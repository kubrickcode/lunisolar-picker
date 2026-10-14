import type { CalendarSystem } from '@lunisolar-picker/calendar';
import type { LocaleData, Weekday } from '@lunisolar-picker/core';
import { type Context, createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react';

const EMPTY_SETTINGS: LunisolarSettings = {};

export const LunisolarSettingsContext: Context<LunisolarSettings> = createContext<LunisolarSettings>(EMPTY_SETTINGS);

export type LunisolarSettings = {
  readonly calendars?: readonly CalendarSystem[] | undefined;
  readonly locale?: LocaleData | undefined;
  readonly timeZone?: string | undefined;
  readonly today?: string | undefined;
  readonly weekStartsOn?: Weekday | undefined;
};

export interface LunisolarProviderProps extends LunisolarSettings {
  readonly children: ReactNode;
}

export const LunisolarProvider = ({
  calendars,
  children,
  locale,
  timeZone,
  today,
  weekStartsOn,
}: LunisolarProviderProps): ReactElement => {
  const outer = useContext(LunisolarSettingsContext);
  const settings = useMemo(
    () => ({
      calendars: calendars ?? outer.calendars,
      locale: locale ?? outer.locale,
      timeZone: timeZone ?? outer.timeZone,
      today: today ?? outer.today,
      weekStartsOn: weekStartsOn ?? outer.weekStartsOn,
    }),
    [calendars, locale, outer, timeZone, today, weekStartsOn],
  );
  return <LunisolarSettingsContext value={settings}>{children}</LunisolarSettingsContext>;
};
