import type { CalendarId, CalendarSystem, EpochDay } from '@lunisolar-picker/calendar';
import type { PickerContext } from '../context';
import { boundsFor } from '../grid/calendar-math';

export interface SelectedDay {
  readonly epochDay: EpochDay;
  readonly calendarId: CalendarId;
}

export const isSelectableDay = (epochDay: EpochDay, calendar: CalendarSystem, context: PickerContext): boolean => {
  const bounds = boundsFor(calendar, context.constraints);
  return epochDay >= bounds.min && epochDay <= bounds.max && !context.constraints.isEpochDayDisabled(epochDay);
};
