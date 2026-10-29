import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { CalendarViewApi } from './calendar-view-api';
import type { CalendarApi } from './use-calendar';

export const CalendarViewContext: Context<CalendarViewApi | null> = createContext<CalendarViewApi | null>(null);

export const SingleCalendarContext: Context<CalendarApi | null> = createContext<CalendarApi | null>(null);

export const useCalendarView = (): CalendarViewApi => {
  const api = useContext(CalendarViewContext);
  if (!api)
    throw new LunisolarPickerError('Calendar parts must be rendered inside Calendar.Root or RangeCalendar.Root');
  return api;
};

export const useSingleCalendar = (): CalendarApi => {
  const api = useContext(SingleCalendarContext);
  if (!api) throw new LunisolarPickerError('this part must be rendered inside Calendar.Root');
  return api;
};
