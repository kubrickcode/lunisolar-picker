import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { TimeFieldApi } from './use-time-field';

export const TimeFieldContext: Context<TimeFieldApi | null> = createContext<TimeFieldApi | null>(null);

export const useTimeFieldContext = (): TimeFieldApi => {
  const field = useContext(TimeFieldContext);
  if (!field) throw new LunisolarPickerError('TimeField parts must be rendered inside <TimeField.Root>');
  return field;
};
