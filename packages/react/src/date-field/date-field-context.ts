import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { DateFieldCore } from './use-date-field-core';

export const DateFieldContext: Context<DateFieldCore | null> = createContext<DateFieldCore | null>(null);

export const useDateFieldContext = (): DateFieldCore => {
  const field = useContext(DateFieldContext);
  if (!field) {
    throw new LunisolarPickerError('DateField parts must be rendered inside <DateField.Root> or a DateRangeField side');
  }
  return field;
};
