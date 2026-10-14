import type { CalendarSystem } from '@lunisolar-picker/calendar';
import type { LocaleData, Weekday } from '@lunisolar-picker/core';
import { type Context, createContext, type ReactElement, type ReactNode, useMemo } from 'react';

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

export const LunisolarSettingsContext: Context<LunisolarSettings> = createContext<LunisolarSettings>({});

export const LunisolarProvider = ({
  calendars,
  children,
  locale,
  timeZone,
  today,
  weekStartsOn,
}: LunisolarProviderProps): ReactElement => {
  const settings = useMemo(
    () => ({ calendars, locale, timeZone, today, weekStartsOn }),
    [calendars, locale, timeZone, today, weekStartsOn],
  );
  return <LunisolarSettingsContext value={settings}>{children}</LunisolarSettingsContext>;
};
