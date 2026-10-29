import { LunisolarPickerError } from '@lunisolar-picker/calendar';

export const END_OF_DAY_HOUR = 24;
export const LAST_HOUR = 23;
export const MINUTES_PER_HOUR = 60;
export const TIME_PART_DIGITS = 2;

export const assertMinuteStep = (minuteStep: number): void => {
  const isValid = Number.isInteger(minuteStep) && minuteStep >= 1 && MINUTES_PER_HOUR % minuteStep === 0;
  if (!isValid) {
    throw new LunisolarPickerError(`minuteStep must be an integer from 1 to 60 that divides 60, got ${minuteStep}`);
  }
};
