import type { CalendarSystem, ValidationReason } from '@lunisolar-picker/calendar';
import type { LocaleData, Validity, Weekday } from '@lunisolar-picker/core';

export interface SharedPickerProps {
  readonly calendars?: readonly CalendarSystem[] | undefined;
  readonly disabled?: boolean | undefined;
  readonly form?: string | undefined;
  readonly invalid?: boolean | undefined;
  readonly locale?: LocaleData | undefined;
  readonly name?: string | undefined;
  // Goal: 포커스가 부품 전체를 벗어날 때 한 번. react-hook-form Controller의 field.onBlur를 그대로 연결함
  readonly onBlur?: (() => void) | undefined;
  readonly onInvalidValue?: ((input: string, reason: ValidationReason) => void) | undefined;
  readonly readOnly?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly timeZone?: string | undefined;
  readonly today?: string | undefined;
  readonly weekStartsOn?: Weekday | undefined;
}

export interface ValueChangeDetails {
  readonly validity: Validity;
}
