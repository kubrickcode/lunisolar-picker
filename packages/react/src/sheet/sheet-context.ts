import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { SheetApi } from './use-sheet';

export const SheetContext: Context<SheetApi | null> = createContext<SheetApi | null>(null);

export const useSheetContext = (): SheetApi => {
  const sheet = useContext(SheetContext);
  if (!sheet) throw new LunisolarPickerError('Sheet parts must be rendered inside <Sheet.Root>');
  return sheet;
};
