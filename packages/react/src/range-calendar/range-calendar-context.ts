import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { RangeCalendarApi } from './use-range-calendar';

export const RangeCalendarContext: Context<RangeCalendarApi | null> = createContext<RangeCalendarApi | null>(null);

export const useRangeCalendarContext = (): RangeCalendarApi => {
  const api = useContext(RangeCalendarContext);
  if (!api) throw new LunisolarPickerError('this part must be rendered inside RangeCalendar.Root');
  return api;
};
