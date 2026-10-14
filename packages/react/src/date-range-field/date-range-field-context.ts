import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { DateRangeFieldApi } from './use-date-range-field';

export const DateRangeFieldContext: Context<DateRangeFieldApi | null> = createContext<DateRangeFieldApi | null>(null);

export const useDateRangeFieldContext = (): DateRangeFieldApi => {
  const field = useContext(DateRangeFieldContext);
  if (!field) throw new LunisolarPickerError('DateRangeField parts must be rendered inside <DateRangeField.Root>');
  return field;
};
