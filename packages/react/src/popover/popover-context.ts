import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { PopoverApi } from './use-popover';

export const PopoverContext: Context<PopoverApi | null> = createContext<PopoverApi | null>(null);

export const usePopoverContext = (): PopoverApi => {
  const popover = useContext(PopoverContext);
  if (!popover) throw new LunisolarPickerError('Popover parts must be rendered inside <Popover.Root>');
  return popover;
};
